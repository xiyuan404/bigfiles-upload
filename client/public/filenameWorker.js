// declare const self: Worker;
// eslint-disable-next-line no-restricted-globals
//
//
//
const bufferToHex = (hashBuffer) => {
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString("16").padStart(2, "0"))
    .join("");
};

const calculateFileHash = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return bufferToHex(hashBuffer);
};

const getFileName = async (file) => {
  // 根据文件内容生成哈希，作为文件唯一标识， 防止文件上传过程中丢包（完整性校验）, 以及后续避免重传
  const fileHash = await calculateFileHash(file);
  // 取出文件扩展名
  const fileExtension = file.name.split(".").pop();
  return `${fileHash}.${fileExtension}`;
};
self.addEventListener("message", async (e) => {
  const file = e.data;
  const filename = await getFileName(file);
  // eslint-disable-next-line no-restricted-globals
  self.postMessage(filename);
});

// const createChunks = file => {
//   const chunks = []

//   for (let start = 0; start < file.size; start + CHUNK_SIZE) {
//     const end = Math.min(start + CHUNK_SIZE, file.size)
//     chunks.push({ chunk:file.slices(start, end), chunkName: })
//   }

//   return chunks
// }
