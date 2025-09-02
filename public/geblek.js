const socket = io();

// ==================== LOG ====================
function log(msg){
    const box=document.getElementById("log-box");
    const p=document.createElement("div");
    p.textContent=`[${new Date().toLocaleTimeString()}] ${msg}`;
    box.appendChild(p);
    box.scrollTop = box.scrollHeight;
}

socket.on("log_update", entry=>log(entry.message));

// ==================== FETCH VIDEO ====================
async function fetchVideos(){
    try{
        const res = await fetch("/api/videos");
        const data = await res.json();
        const select=document.getElementById("video-select");
        select.innerHTML="<option value=''>--Select Video--</option>";
        data.videos.forEach(v=>{
            const o=document.createElement("option");
            o.value=o.textContent=v;
            select.appendChild(o);
        });
    }catch(err){ console.error(err); alert("Gagal memuat daftar video"); }
}
fetchVideos();

// ==================== SLIDERS ====================
["fps","bitrate","segment","audio"].forEach(type=>{
    ["min","max"].forEach(suffix=>{
        const slider=document.getElementById(`${type}-${suffix}`);
        slider.addEventListener("input", ()=>{
            const minVal=document.getElementById(`${type}-min`).value;
            const maxVal=document.getElementById(`${type}-max`).value;
            document.getElementById(`${type}-range-display`).textContent=`${minVal}-${maxVal}`;
            document.getElementById(`${type}-${suffix}-val`).textContent=slider.value;
        });
    });
});

// ==================== PRESETS & RESOLUTIONS ====================
const presets=["fast","ultrafast","superfast","veryfast","faster","medium","slow","slower","veryslow"];
const presetSelect=document.getElementById("preset");
presets.forEach(p=>{const o=document.createElement("option");o.value=o.textContent=p; presetSelect.appendChild(o);});
presetSelect.value="fast";

const resolutions=["720x1280","1280x720","1080x1920","1920x1080"];
const resSelect=document.getElementById("resolution");
resolutions.forEach(r=>{const o=document.createElement("option");o.value=o.textContent=r; resSelect.appendChild(o);});
resSelect.value="720x1280";

// ==================== ACTIVE STREAMS ====================
const activeStreamsEl = document.getElementById("active-streams");
const activeStreams = {};

function addActiveStream(id, video, rtmp){
    const div=document.createElement("div");
    div.id=`stream-${id}`;
    div.className="flex items-center justify-between bg-gray-700 p-2 rounded";
    div.innerHTML=`<span>${video} -> ${rtmp}</span> <button class="bg-red-600 px-2 py-1 rounded">Stop</button>`;
    div.querySelector("button").addEventListener("click", async ()=>{
        await fetch("/api/stop",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({streamId:id})});
        div.remove();
        delete activeStreams[id];
    });
    activeStreamsEl.appendChild(div);
    activeStreams[id]=div;
}

// ==================== START STREAM ====================
document.getElementById("start-btn").addEventListener("click", async ()=>{
    const video = document.getElementById("video-select").value;
    const rtmp = document.getElementById("rtmp-url").value;
    if(!video||!rtmp) return alert("Pilih video & masukkan RTMP URL");

    const fpsRange=[parseInt(document.getElementById("fps-min").value),parseInt(document.getElementById("fps-max").value)];
    const bitrateRange=[parseInt(document.getElementById("bitrate-min").value),parseInt(document.getElementById("bitrate-max").value)];
    const segmentRange=[parseInt(document.getElementById("segment-min").value),parseInt(document.getElementById("segment-max").value)];
    const audioRange=[parseInt(document.getElementById("audio-min").value),parseInt(document.getElementById("audio-max").value)];
    const preset=document.getElementById("preset").value;
    const resolution=document.getElementById("resolution").value;

    log(`🚀 Streaming ${video} -> ${rtmp}`);
    try{
        const res=await fetch("/api/start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({video,rtmp,fpsRange,bitrateRange,segmentRange,audioRange,preset,resolution})});
        const data=await res.json();
        if(!data.success) return alert(data.message);
        addActiveStream(data.streamId,video,rtmp);
    }catch(err){console.error(err);alert("Gagal memulai streaming");}
});

// ==================== LOAD LOGS ====================
async function loadLogs(){
    try{
        const res=await fetch("/api/logs");
        const data=await res.json();
        data.logs.forEach(l=>log(l));
    }catch(err){console.error(err);}
}
loadLogs();
