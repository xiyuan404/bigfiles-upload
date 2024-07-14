const express = require("express");
const cors = require("cors");
const logger = require("morgan");
const path = require("path");
const fs = require("fs-extra");
const { StatusCodes } = require("http-status-codes");

const CHUNK_SIZE = 100 * 1024 * 1024;

const app = express();

app.use(cors()); // 允许所有请求跨域
app.use(logger("dev")); // log all request to STDOUT
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // body-parser
app.use(express.static(path.resolve(__dirname, "public")));

// 准备一个目录存放合并后的文件
const PUBLIC_DIR = path.resolve(__dirname, "public");
fs.ensureDirSync(PUBLIC_DIR);
// 准备一个目录存放分片的文件
const TEMP_DIR = path.resolve(__dirname, "temp");
fs.ensureDirSync(TEMP_DIR);

app.post("/upload/:filename", async (req, res, next) => {
  // 从路径参数中取出文件名
  const { filename } = req.params;
  // 从查询参数取出分片索引
  const { chunkindex } = req.query;

  // 定义存放上传分片的目录
  const chunkDir = path.resolve(TEMP_DIR, filename);
  // 定义存放分片的路径
  const chunkName = `${filename}-${chunkindex}`;
  const chunkPath = path.resolve(chunkDir, chunkName);
  // 确保存放分片目录存在
  await fs.ensureDir(chunkDir);
  // 写入文件的起始位置
  const start = isNaN(req.query.start) ? 0 : parseInt(req.query.start, 10);
  // 创建文件的可写流
  const ws = fs.createWriteStream(chunkPath, { start, flags: "a" });
  // 以管道的方式把请求体中的流数据写入到文件中
  try {
    await pipeStream(req, ws);
  } catch (error) {
    next(error);
  }

  res.json({ success: true });
});

app.get("/merge/:filename", async (req, res, next) => {
  //通过路径参数获取文件名
  const { filename } = req.params;
  try {
    await mergeChunks(filename);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 提供一个接口返回已经上传了的分片和大小
app.get("/verify/:filename", async (req, res) => {
  // 从路径参数中获取文件名
  const { filename } = req.params;
  // 文件是否已经在服务端存在
  const filePath = path.resolve(PUBLIC_DIR, filename);
  const existFile = await fs.pathExists(filePath);
  // debugger;
  // 如果存在则不需要上传
  if (existFile) {
    return res.json({ success: true, needUpload: false });
  }
  const chunksDir = path.resolve(TEMP_DIR, filename);
  const existDir = await fs.pathExists(chunksDir);
  let uploadedChunkList = [];
  if (existDir) {
    const chunksName = await fs.readdir(chunksDir);
    uploadedChunkList = await Promise.all(
      chunksName.map(async (chunkName) => {
        const chunkPath = path.resolve(chunksDir, chunkName);
        const { size } = await fs.stat(chunkPath);
        return { uploadedChunkName: chunkName, size };
      }),
    );
  }
  res.json({ success: true, needUpload: true, uploadedChunkList });
});

async function mergeChunks(filename) {
  const chunksDir = path.resolve(TEMP_DIR, filename);

  const chunksName = await fs.readdir(chunksDir);
  debugger;

  // 去除mac系统生成的文件名git l
  // chunksName.filter((chunkNamnpe) => chunkName !== ".DS_Store");
  // 分片升序排列
  chunksName.sort(
    (a, b) => Number(a.split("-").pop()) - Number(b.split("-").pop()),
  );

  // 合并路径
  const mergePath = path.resolve(PUBLIC_DIR, filename);

  const pipes = chunksName.map((chunkName) => {
    const chunkPath = path.resolve(chunksDir, chunkName);
    const index = chunkName.split("-").pop();
    const start = Number(index) * CHUNK_SIZE;
    // const end = (index + 1) * CHUNK_SIZE;
    return pipeStream(
      fs.createReadStream(chunkPath, { autoClose: true }),
      fs.createWriteStream(mergePath, {
        start,
        falgs: "a",
      }),
    );
  });
  // 并发写入目标文件中
  await Promise.all(pipes);

  // 删除上传文件的分片目录
  await fs.rm(chunksDir, { recursive: true });
}

function pipeStream(rs, ws) {
  // debugger;
  return new Promise((resolve, reject) => {
    rs.pipe(ws).on("finish", resolve).on("error", reject);
  });
}

app.listen(8080, () => {
  console.log("server start at port 8080");
});
