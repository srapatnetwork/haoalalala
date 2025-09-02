import express from "express";
import http from "http";
import { Server } from "socket.io";
import spawn from "cross-spawn";
import fs from "fs";
import path from "path";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static("public"));

let logs = [];
function log(msg) {
  const timestamp = new Date().toLocaleTimeString();
  const entry = `[${timestamp}] ${msg}`;
  logs.push(entry);
  if (logs.length > 1000) logs = logs.slice(-1000);
  io.emit("log_update", { message: entry });
  console.log(entry);
}

app.get("/api/videos", (req, res) => {
  const videoDir = path.join(process.cwd(), "videos");
  if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir);
  const files = fs.readdirSync(videoDir).filter(f => [".mp4",".mkv",".mov",".flv"].includes(path.extname(f).toLowerCase()));
  res.json({ videos: files });
});

let activeStreams = {};

app.post("/api/start", (req, res) => {
  const {
    video, rtmp,
    fpsRange, bitrateRange,
    segmentRange, audioRange,
    preset, resolution
  } = req.body;

  if (!video || !rtmp) return res.json({ success: false, message: "Video & RTMP required" });

  const videoPath = path.join(process.cwd(), "videos", video);
  if (!fs.existsSync(videoPath)) return res.json({ success: false, message: "Video not found" });

  const streamId = Date.now().toString();
  log(`Starting stream ${streamId}: ${video} -> ${rtmp}`);

  const ffmpegPath = path.join(process.cwd(), "ffmpeg.exe");
  const ffprobePath = path.join(process.cwd(), "ffprobe.exe");
  let videoDuration = 300;

  const ffprobe = spawn(ffprobePath, [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    videoPath
  ]);

  ffprobe.stdout.on("data", data => videoDuration = parseFloat(data.toString()));
  ffprobe.stderr.on("data", data => log(`FFprobe error: ${data.toString()}`));

  ffprobe.on("close", () => {
    let totalTime = 0;
    let cycle = 1;

    function runCycle() {
      if (!activeStreams[streamId]) return;

      const fps = Math.floor(Math.random() * (fpsRange[1]-fpsRange[0]+1))+fpsRange[0];
      const bitrate = Math.floor(Math.random() * (bitrateRange[1]-bitrateRange[0]+1))+bitrateRange[0];
      const audioBitrate = Math.floor(Math.random() * (audioRange[1]-audioRange[0]+1))+audioRange[0];
      const segmentDuration = segmentRange[0] || 15;

      log(`Stream ${streamId} Cycle ${cycle}: FPS=${fps}, Bitrate=${bitrate}k, Audio=${audioBitrate}k, Segment=${segmentDuration}s`);

      const ff = spawn(ffmpegPath, [
        "-nostdin", "-y", "-re",
        "-ss", totalTime.toString(),
        "-i", videoPath,
        "-t", segmentDuration.toString(),
        "-vf", `fps=${fps},scale=${resolution}`,
        "-c:v","libx264","-preset",preset,
        "-b:v",`${bitrate}k`, "-maxrate",`${bitrate}k`, "-bufsize",`${bitrate*2}k`,
        "-c:a","aac","-b:a",`${audioBitrate}k`,
        "-f","flv", rtmp
      ],{
        detached: true,
        stdio: "ignore"
       });

      activeStreams[streamId].process = ff;

      ff.unref();

      ff.on("close", () => {
        totalTime += segmentDuration;
        cycle++;
        if(totalTime >= videoDuration) totalTime = 0;
        setImmediate(runCycle);
      });
    }

    activeStreams[streamId] = { video, rtmp, process: null };
    runCycle();
  });

  res.json({ success: true, streamId });
});

app.post("/api/stop", (req,res)=>{
  const { streamId } = req.body;
  if(!activeStreams[streamId]) return res.json({success:false,message:"Stream not found"});
  const ff = activeStreams[streamId].process;
  if(ff) ff.kill();
  delete activeStreams[streamId];
  log(`Stopped stream ${streamId}`);
  res.json({success:true});
});

app.get("/api/logs",(req,res)=>res.json({logs:logs.slice(-100)}));

io.on("connection", socket=>{
  log(`Client connected: ${socket.id}`);
  socket.on("disconnect",()=>log(`Client disconnected: ${socket.id}`));
});

const PORT = process.env.PORT||3000;
server.listen(PORT,()=>log(`Server running on http://localhost:${PORT}`));
