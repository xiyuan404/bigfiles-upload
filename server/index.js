const express = require("express");
const cors = require("cors");
const logger = require("morgan");
const app = express();

app.use(cors()); // 允许所有请求跨域
app.use(logger("dev")); // log all request to STDOUT
// app.use(express.urlencoded({ extended: true })); // body-parser
// 准备一个目录存放合并后的文件
// 准备一个目录存放分片的文件

app.post("/upload/:filename", async (req, res) => {
  // 从路径参数中取出文件名
  const { filename } = req.params;
  console.log(filename);
  // 从查询参数取出分片索引
  const { chunkindex } = req.query;
  console.log(chunkindex);
  res.json({ success: true });
});

app.get("/merge/:filename", async (req, res) => {
  res.json({ success: true });
});

app.listen(8080, () => {
  console.log("server start at port 8080");
});
