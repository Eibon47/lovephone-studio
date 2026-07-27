const ACCEPTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
]);
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

export function validateImageFile(file) {
  if (!file) throw new Error('请选择图片文件。');
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('仅支持 PNG、JPG、WebP 或 GIF 图片。');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('图片不能超过 5MB，请先压缩后再上传。');
  }
}

export function computeSquareCrop(width, height) {
  const size = Math.min(Number(width) || 0, Number(height) || 0);
  if (!size) throw new Error('无法读取图片尺寸。');
  return {
    sourceX: (width - size) / 2,
    sourceY: (height - size) / 2,
    sourceSize: size
  };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片已损坏或无法读取。'));
    };
    image.src = url;
  });
}

export function scaledImageDimensions(width, height, maxSide = 1200) {
  const sourceWidth = Number(width) || 0;
  const sourceHeight = Number(height) || 0;
  if (!sourceWidth || !sourceHeight) throw new Error('无法读取图片尺寸。');
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale))
  };
}

export async function readOptimizedImage(file, maxSide = 1200) {
  validateImageFile(file);
  const image = await loadImage(file);
  const size = scaledImageDimensions(image.naturalWidth, image.naturalHeight, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器无法处理图片。');
  context.drawImage(image, 0, 0, size.width, size.height);
  const result = canvas.toDataURL('image/webp', 0.84);
  if (result.length > 2_000_000) {
    throw new Error('处理后的图片仍然太大，请换一张更简单的图片。');
  }
  return result;
}

export async function readSquareImage(file, outputSize = 512) {
  validateImageFile(file);
  const image = await loadImage(file);
  const crop = computeSquareCrop(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器无法处理图片。');
  context.drawImage(
    image,
    crop.sourceX,
    crop.sourceY,
    crop.sourceSize,
    crop.sourceSize,
    0,
    0,
    outputSize,
    outputSize
  );
  const result = canvas.toDataURL('image/webp', 0.86);
  if (result.length > 1_500_000) {
    throw new Error('处理后的图片仍然太大，请换一张更简单的图片。');
  }
  return result;
}
