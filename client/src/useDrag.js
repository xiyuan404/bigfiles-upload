import { useEffect, useState, useCallback } from "react";
import { message } from "antd";
import { MAX_FILE_SIZE } from "./constant";

const useDrag = (uploadContainerRef) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState({
    url: null,
    type: null,
  });
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const checkSelected = (file) => {
    if (!file) {
      message.error("没有选中任何文件");
      return;
    } else if (file.size > MAX_FILE_SIZE) {
      message.error(`文件大小不能超过${MAX_FILE_SIZE}`);
      return;
    } else if (
      !(file.type.startsWith("image/") || file.type.startsWith("video/"))
    ) {
      message.error("文件类型必须是图片或视频");
      return;
    }
    setSelectedFile(file);
  };
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    checkSelected(e.dataTransfer.files[0]);
  }, []);

  // 点击上传
  useEffect(() => {
    const uploadContainer = uploadContainerRef.current;
    uploadContainer.addEventListener("click", () => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.style.display = "none";
      fileInput.addEventListener("change", (e) => {
        checkSelected(e.target.files[0]);
      });
      document.body.append(fileInput);
      // 手动触发
      fileInput.click();
    });
  }, []);

  useEffect(() => {
    const uploadContainer = uploadContainerRef.current;
    uploadContainer.addEventListener("dragenter", handleDrag);
    uploadContainer.addEventListener("dragover", handleDrag);
    uploadContainer.addEventListener("drop", handleDrop);
    uploadContainer.addEventListener("dragleave", handleDrop);
    return () => {
      uploadContainer.removeEventListener("dragenter", handleDrag);
      uploadContainer.removeEventListener("dragover", handleDrag);
      uploadContainer.removeEventListener("drop", handleDrop);
      uploadContainer.removeEventListener("dragleave", handleDrop);
    };
  }, []);

  useEffect(() => {
    if (!selectedFile) return;
    const url = URL.createObjectURL(selectedFile);
    setFilePreview({
      url,
      type: selectedFile.type,
    });
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);
  const resetFileStatus = () => {
    setSelectedFile(null);
    setFilePreview({
      type: null,
      url: null,
    });
  };
  return { filePreview, selectedFile, resetFileStatus };
};

export default useDrag;
