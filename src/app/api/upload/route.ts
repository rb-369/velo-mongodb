import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import { collections } from "@/lib/db";
import { randomUUID } from "crypto";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function hasValidCloudinaryConfig(): boolean {
  if (process.env.CLOUDINARY_URL && process.env.CLOUDINARY_URL.trim().length > 0) {
    return true;
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  return Boolean(cloudName && apiKey && apiSecret);
}

if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ secure: true });
} else if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ message: "No file uploaded" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ message: "Only image files are allowed" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ message: "Image size must be 5MB or less" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. If Cloudinary credentials are valid, attempt Cloudinary upload
    if (hasValidCloudinaryConfig()) {
      try {
        const result = await new Promise<{ secure_url: string; public_id: string }>(
          (resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              {
                folder: "nextjs-blog-posts",
                resource_type: "image",
              },
              (error, uploadResult) => {
                if (error || !uploadResult) {
                  reject(error || new Error("Cloudinary upload failed"));
                  return;
                }

                resolve({
                  secure_url: uploadResult.secure_url,
                  public_id: uploadResult.public_id,
                });
              }
            );

            streamifier.createReadStream(buffer).pipe(uploadStream);
          }
        );

        return NextResponse.json(
          {
            secureUrl: result.secure_url,
            publicId: result.public_id,
          },
          { status: 200 }
        );
      } catch (cloudinaryError) {
        console.warn(
          "Cloudinary upload failed or unconfigured, falling back to database storage:",
          cloudinaryError
        );
      }
    }

    // 2. Fallback to MongoDB Atlas database storage
    const imageId = `img_${randomUUID()}`;
    await collections.uploads.insertOne({
      id: imageId,
      filename: file.name,
      contentType: file.type || "image/jpeg",
      size: file.size,
      data: buffer,
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        secureUrl: `/api/upload/${imageId}`,
        publicId: imageId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Upload endpoint error:", error);
    const message = error instanceof Error ? error.message : "Failed to upload image";
    return NextResponse.json({ message }, { status: 500 });
  }
}
