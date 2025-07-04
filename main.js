/*jshint esversion:6*/

$(function () {
    const { InferenceEngine: Engine, CVImage: Frame } = inferencejs;
    const engine = new Engine();

    const video = $("video")[0];

    let sessionId;
    let cameraMode = "environment";

    const startVideoStream = navigator.mediaDevices
        .getUserMedia({
            audio: false,
            video: { facingMode: cameraMode }
        })
        .then(function (stream) {
            return new Promise(function (resolve) {
                video.srcObject = stream;
                video.onloadeddata = function () {
                    video.play();
                    resolve();
                };
            });
        });

    const loadModel = new Promise(function (resolve, reject) {
        engine
            .startWorker("universidad-laboral", "6", "rf_eeXth5tiR9O7pYByKLBZQYsEgf72")
            .then(function (id) {
                sessionId = id;
                resolve();
            })
            .catch(reject);
    });

    Promise.all([startVideoStream, loadModel]).then(function () {
        $("body").removeClass("loading");
        resizeCanvas();
        detectFrame();
    });

    let canvas, ctx;
    const font = "16px sans-serif";

    function videoDimensions(video) {
        const videoRatio = video.videoWidth / video.videoHeight;
        let width = video.offsetWidth,
            height = video.offsetHeight;
        const elementRatio = width / height;

        if (elementRatio > videoRatio) {
            width = height * videoRatio;
        } else {
            height = width / videoRatio;
        }

        return { width, height };
    }

    $(window).resize(resizeCanvas);

    function resizeCanvas() {
        $("canvas").remove();
        canvas = $("<canvas/>");
        ctx = canvas[0].getContext("2d");

        const dimensions = videoDimensions(video);
        canvas[0].width = video.videoWidth;
        canvas[0].height = video.videoHeight;

        canvas.css({
            width: dimensions.width,
            height: dimensions.height,
            left: ($(window).width() - dimensions.width) / 2,
            top: ($(window).height() - dimensions.height) / 2
        });

        $("body").append(canvas);
    }

    function renderPredictions(predictions) {
        const scale = 1;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        predictions.forEach(pred => {
            const { x, y, width, height } = pred.bbox;
            ctx.strokeStyle = pred.color;
            ctx.lineWidth = 4;
            ctx.strokeRect((x - width / 2) / scale, (y - height / 2) / scale, width / scale, height / scale);
            ctx.fillStyle = pred.color;
            const textWidth = ctx.measureText(pred.class).width;
            const textHeight = parseInt(font, 10);
            ctx.fillRect((x - width / 2) / scale, (y - height / 2) / scale, textWidth + 8, textHeight + 4);
        });

        predictions.forEach(pred => {
            const { x, y, width, height } = pred.bbox;
            ctx.font = font;
            ctx.textBaseline = "top";
            ctx.fillStyle = "#000000";
            ctx.fillText(pred.class, (x - width / 2) / scale + 4, (y - height / 2) / scale + 1);
        });
    }

    let prevTime;
    const pastFrameTimes = [];

    function detectFrame() {
        if (!sessionId) return requestAnimationFrame(detectFrame);
        const frame = new Frame(video);
        engine.infer(sessionId, frame)
            .then(function (predictions) {
                requestAnimationFrame(detectFrame);
                renderPredictions(predictions);

                if (prevTime) {
                    pastFrameTimes.push(Date.now() - prevTime);
                    if (pastFrameTimes.length > 30) pastFrameTimes.shift();
                    const total = pastFrameTimes.reduce((a, b) => a + b / 1000, 0);
                    const fps = pastFrameTimes.length / total;
                    $("#fps").text(Math.round(fps));
                }
                prevTime = Date.now();
            })
            .catch(function () {
                requestAnimationFrame(detectFrame);
            });
    }
});
