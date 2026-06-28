export function resizeCanvasLayer(canvas, context, width, height, dpr) {
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function clearCanvas(context, width, height) {
  context.clearRect(0, 0, width, height);
}

export function fillCanvas(context, width, height, color) {
  context.fillStyle = color;
  context.fillRect(0, 0, width, height);
}

export function drawPixelDiamond(context, x, y, size) {
  const pixel = Math.max(2, Math.round(size));
  const left = Math.round(x - pixel / 2);
  const top = Math.round(y - pixel / 2);

  context.fillRect(left, top - pixel, pixel, pixel);
  context.fillRect(left - pixel, top, pixel, pixel);
  context.fillRect(left, top, pixel, pixel);
  context.fillRect(left + pixel, top, pixel, pixel);
  context.fillRect(left, top + pixel, pixel, pixel);
}
