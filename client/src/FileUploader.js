import { InboxOutlined } from "@ant-design/icons";
import { Button, message, Progress } from "antd";
import { useRef, useState } from "react";
import useDrag from "./useDrag";
import { CHUNK_SIZE, UploadStatus } from "./constant";
import axiosInstance from "./axiosInstance";
import axios from "axios";

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

// const createChunks = file => {
//   const chunks = []

//   for (let start = 0; start < file.size; start + CHUNK_SIZE) {
//     const end = Math.min(start + CHUNK_SIZE, file.size)
//     chunks.push({ chunk:file.slices(start, end), chunkName: })
//   }

//   return chunks
// }
const createChunks = (file) => {
  const chunks = [];
  const count = Math.ceil(file.size / CHUNK_SIZE); // 分片数
  // debugger;
  for (let i = 0; i < count; i++) {
    chunks.push({
      chunk: file.slice(
        i * CHUNK_SIZE,
        Math.min((i + 1) * CHUNK_SIZE, file.size),
      ),
      chunkIndex: `${i}`,
    });
  }
  return chunks;
};
const createRequest = (
  fileName,
  chunk,
  chunkIndex,
  setUploadProgress,
  cancelToken,
  start,
  totalSize,
) => {
  axiosInstance.post(`/upload/${fileName}`, chunk, {
    headers: {
      "Content-Type": "application/octet-stream", // 请求体格式
    },
    onUploadProgress: (progressEvent) => {
      const percentComplted = Math.round(
        // 上次上传的字节+本次上传的字节
        ((progressEvent.loaded + start) * 100) / totalSize,
      );
      setUploadProgress((prevProgress) => ({
        ...prevProgress,
        [chunkIndex]: percentComplted,
      }));
    },
    params: {
      //拼接分片索引到查询参数中
      chunkindex: chunkIndex,
      start,
    },
    cancelToken: cancelToken.token,
  });
};

const uploadFile = async (
  selectedFile,
  fileName,
  setUploadProgress,
  resetAllStatus,
  setCancelTokens,
) => {
  const { needUpload, uploadedChunkList } =
    await axiosInstance.get("/verify/:filename");
  if (!needUpload) {
    message.warning("文件已存在,无需重复上传");
    return;
  }

  // 文件切片
  const chunks = createChunks(selectedFile);
  const newCancelTokens = [];

  // 并行上传
  const requests = chunks.map(({ chunk, chunkIndex }) => {
    const cancelToken = axios.CancelToken.source();
    newCancelTokens.push(cancelToken);
    // 分片是否部分或全部上传
    const existingChunk = uploadedChunkList.find(
      ({ uploadChunkName }) => uploadChunkName.split("-").pop() === chunkIndex,
    );
    if (existingChunk) {
      // 分片已经上传大小
      const uploadedSize = existingChunk.size;
      // 还需上传的部分
      const remaingChunk = existingChunk.slice(uploadedSize);

      // 没有还需上传的部分
      if (remaingChunk.size === 0) {
        setUploadProgress((prevProgress) => ({
          ...prevProgress,
          [chunkIndex]: 100,
        }));
        return Promise.resolve();
      }
      // 设置上传进度为上次上传部分
      setUploadProgress((prevProgress) => ({
        ...prevProgress,
        [chunkIndex]: uploadedSize,
      }));
      // 还有还需上传的部分
      return createRequest(
        fileName,
        remaingChunk,
        chunkIndex,
        setUploadProgress,
        cancelToken,
        uploadedSize,
        chunk.size,
      );
    } else {
      return createRequest(
        fileName,
        chunk,
        chunkIndex,
        setUploadProgress,
        cancelToken,
        0,
        chunk.size,
      );
    }
  });
  setCancelTokens(newCancelTokens);
  try {
    await Promise.all(requests);
    // 等待分片上传完并没有报错，发送合并请求
    await axiosInstance.get(`/merge/${fileName}`);
    resetAllStatus();
    message.success("上传成功");
  } catch (error) {
    if (axios.isCancel(error)) {
      console.log("上传暂停", error);
      message.success("上传暂停");
    } else {
      console.log("上传出错", error);
      message.error("上传出错");
    }
  }
};

const FileUploader = () => {
  const uploadContainerRef = useRef(null);
  const { filePreview, selectedFile, resetFileStatus } =
    useDrag(uploadContainerRef);
  // 上传进度
  const [uploadProgress, setUploadProgress] = useState({});
  // 上传状态控制
  const [uploadStatus, setUploadStatus] = useState(UploadStatus.NOT_STARTED);
  // 暂停上传tokens
  const [cancelTokens, setCancelTokens] = useState([]);

  const resetAllStatus = () => {
    resetFileStatus();
    setUploadProgress({});
    setUploadStatus(UploadStatus.NOT_STARTED);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      message.warning("你尚未选中任何文件");
      return;
    }

    const fileName = await getFileName(selectedFile);

    setUploadStatus(UploadStatus.UPLOADING);
    await uploadFile(
      selectedFile,
      fileName,
      setUploadProgress,
      resetAllStatus,
      setCancelTokens,
    );
  };

  const pauseUpload = () => {
    setUploadStatus(UploadStatus.PASUED);
    cancelTokens.forEach((cancelToken) =>
      cancelToken.cancel("用户主动暂停了上传"),
    );
  };
  // const resumeUpload = () => {};

  const renderButton = () => {
    switch (uploadStatus) {
      case UploadStatus.NOT_STARTED:
        return <Button onClick={handleUpload}>上传</Button>;
      case UploadStatus.UPLOADING:
        return <Button onClick={pauseUpload}>暂停上传</Button>;
      case UploadStatus.PASUED:
        return <Button onClick={handleUpload}> 恢复上传 </Button>;
      default:
        return;
    }
  };

  const renderTotalProgress = () => {
    if (uploadStatus === UploadStatus.NOT_STARTED) return;
    const percents = Object.values(uploadProgress);
    if (percents.length > 0) {
      const totalPercent =
        percents.reduce((acc, curr) => acc + curr, 0) / percents.length;
      return (
        <div>
          <span>总进度 </span>
          <Progress percent={totalPercent} />
        </div>
      );
    }
  };

  const renderProgress = () => {
    if (uploadStatus === UploadStatus.NOT_STARTED) return;
    return Object.keys(uploadProgress).map((chunkIndex) => (
      <div key={chunkIndex}>
        <span> 分片: {chunkIndex} </span>
        <Progress percent={uploadProgress[chunkIndex]} />
      </div>
    ));
  };

  return (
    <>
      <div className="upload-container" ref={uploadContainerRef}>
        {renderFilePreview(filePreview)}
      </div>
      {renderButton()}
      {renderTotalProgress()}
      {renderProgress()}
    </>
  );
};

function renderFilePreview(filePreview) {
  if (filePreview.url) {
    if (filePreview.type.startsWith("image/")) {
      return <img src={filePreview.url} alt="preview" />;
    } else {
      return <video src={filePreview.url} controls />;
    }
  } else {
    return <InboxOutlined />;
  }
}

export default FileUploader;
