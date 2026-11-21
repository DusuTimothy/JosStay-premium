import crypto from "node:crypto";
import {
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_URL,
} from "../config/env.js";

const parseCloudinaryUrl = () => {
  if (!CLOUDINARY_URL) return null;
  try {
    const url = new URL(CLOUDINARY_URL);
    // cloudinary://api_key:api_secret@cloud_name
    const apiKey = decodeURIComponent(url.username || "");
    const apiSecret = decodeURIComponent(url.password || "");
    const cloudName = decodeURIComponent(url.hostname || "");
    if (!apiKey || !apiSecret || !cloudName) return null;
    return { apiKey, apiSecret, cloudName };
  } catch {
    return null;
  }
};

export const getCloudinaryConfig = () => {
  const fromUrl = parseCloudinaryUrl();
  const cloudName = CLOUDINARY_CLOUD_NAME || fromUrl?.cloudName || "";
  const apiKey = CLOUDINARY_API_KEY || fromUrl?.apiKey || "";
  const apiSecret = CLOUDINARY_API_SECRET || fromUrl?.apiSecret || "";
  return { cloudName, apiKey, apiSecret };
};

export const isCloudinaryConfigured = () => {
  const cfg = getCloudinaryConfig();
  return Boolean(cfg.cloudName && cfg.apiKey && cfg.apiSecret);
};

const signParams = (paramsToSign, apiSecret) => {
  const sorted = Object.keys(paramsToSign)
    .filter((key) => paramsToSign[key] !== undefined && paramsToSign[key] !== null && paramsToSign[key] !== "")
    .sort()
    .map((key) => `${key}=${paramsToSign[key]}`)
    .join("&");
  return crypto.createHash("sha1").update(`${sorted}${apiSecret}`).digest("hex");
};

export const createUploadSignature = ({
  folder,
  publicId,
  resourceType = "image",
  timestamp = Math.floor(Date.now() / 1000),
  uploadPreset,
  eager,
  tags,
} = {}) => {
  const cfg = getCloudinaryConfig();
  if (!cfg.cloudName || !cfg.apiKey || !cfg.apiSecret) {
    const error = new Error("Cloudinary is not configured");
    error.status = 503;
    throw error;
  }

  const paramsToSign = {
    timestamp,
    ...(folder ? { folder } : {}),
    ...(publicId ? { public_id: publicId } : {}),
    ...(uploadPreset ? { upload_preset: uploadPreset } : {}),
    ...(eager ? { eager } : {}),
    ...(tags ? { tags } : {}),
  };

  const signature = signParams(paramsToSign, cfg.apiSecret);

  return {
    cloudName: cfg.cloudName,
    apiKey: cfg.apiKey,
    timestamp,
    signature,
    folder: folder || undefined,
    publicId: publicId || undefined,
    tags: tags || undefined,
    resourceType,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cfg.cloudName}/${resourceType}/upload`,
  };
};
