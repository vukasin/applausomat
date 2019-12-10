var audioContext = null;
var mediaStreamSource = null
var meter = null
var shutdown = null
var gage = null
var progress = null
var startTime = null

async function beginDetect() {
  if (audioContext != null) {
    return
  }
  audioContext = new (window.AudioContext || window.webkitAudioContext)()
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaStreamSource = audioContext.createMediaStreamSource(stream)
    meter = createAudioMeter(audioContext)
    mediaStreamSource.connect(meter)

  }
}
async function activateDetect() {
  await beginDetect()
  meter.disabled = false;
  meter.totalVolume = 0;
  startTime = new Date().getTime()
  shutdown = setTimeout(resetDetect, 10000)
  progress = setInterval(() => {
    document.querySelectorAll(".measure-progress").forEach(
      el => el.setAttribute("value", (new Date().getTime() - startTime) / 1000)
    )
  }, 500)
}
function resetDetect() {

  meter.disabled = true;

  document.querySelectorAll(".measure-progress").forEach(el => el.setAttribute("value", 10))
  /*    
  const doc_event = new Event("score")
  doc_event.score = 0.0
  document.dispatchEvent(doc_event)
  */

  clearTimeout(shutdown)
  clearInterval(progress)
}


function createAudioMeter(audioContext, clipLevel, averaging, clipLag) {
  var processor = audioContext.createScriptProcessor(512)
  processor.onaudioprocess = volumeAudioProcess
  processor.clipping = false
  processor.lastClip = 0
  processor.volume = 0
  processor.disabled = true
  processor.totalVolume = 0.0
  processor.clipLevel = clipLevel || 0.98
  processor.averaging = averaging || 0.95
  processor.clipLag = clipLag || 750

  // this will have no effect, since we don't copy the input to the output,
  // but works around a current Chrome bug.
  processor.connect(audioContext.destination)

  processor.checkClipping = function () {
    if (!this.clipping) {
      return false
    }
    if ((this.lastClip + this.clipLag) < window.performance.now()) {
      this.clipping = false
    }
    return this.clipping
  }

  processor.shutdown = function () {
    this.disconnect()
    this.onaudioprocess = null
  }

  setTimeout(resetDetect, 10000);

  return processor
}

function volumeAudioProcess(event) {
  if (this.disabled)
    return;
  const buf = event.inputBuffer.getChannelData(0)
  const bufLength = buf.length
  let sum = 0
  let x

  // Do a root-mean-square on the samples: sum up the squares...
  for (var i = 0; i < bufLength; i++) {
    x = buf[i]
    if (Math.abs(x) >= this.clipLevel) {
      this.clipping = true
      this.lastClip = window.performance.now()
    }
    sum += x * x
  }

  // ... then take the square root of the sum.
  const rms = Math.sqrt(sum / bufLength)

  // Now smooth this out with the averaging factor applied
  // to the previous sample - take the max here because we
  // want "fast attack, slow release."
  this.volume = Math.max(rms, this.volume * this.averaging)
  this.totalVolume += this.volume
  //document.getElementById('audio-value').innerHTML = this.volume
  const doc_event = new Event("score")
  doc_event.score = this.totalVolume
  doc_event.rate = this.volume
  document.dispatchEvent(doc_event)
}

window.onload = () => {
  gage = new JustGage({
    id: "gauge",
    value: 0,
    min: 0,
    max: 300,
    //width: 800,
    //height: 800,
    color: "#ffffff",
    title: "Applausomat"
  });
  //beginDetect()

  document.querySelectorAll('.start').forEach(el => el.onclick = activateDetect)
  document.querySelectorAll('.reset').forEach(el => el.onclick = resetDetect)
  document.addEventListener("score", (e) => {
    gage.refresh(e.score)
  })
}