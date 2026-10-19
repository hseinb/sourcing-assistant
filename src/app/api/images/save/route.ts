import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Target directory for local storage of all app pictures as WebP
const LOCAL_APP_PICS_DIR = 'C:\\Users\\hussi\\Desktop\\China\\AppPics';

export async function POST(req: NextRequest) {
  try {
    // Ensure destination directory exists
    if (!fs.existsSync(LOCAL_APP_PICS_DIR)) {
      fs.mkdirSync(LOCAL_APP_PICS_DIR, { recursive: true });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const itemCode = formData.get('itemCode') as string | null;
    const base64Data = formData.get('base64') as string | null;

    let buffer: Buffer;
    let fileName: string;

    const safeCode = itemCode
      ? String(itemCode).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 25)
      : 'pic';

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    fileName = `${safeCode}_${timestamp}_${randomSuffix}.webp`;

    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (base64Data) {
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
    } else {
      return NextResponse.json({ error: 'No image file or base64 provided' }, { status: 400 });
    }

    const targetFilePath = path.join(LOCAL_APP_PICS_DIR, fileName);
    fs.writeFileSync(targetFilePath, buffer);

    const relativeUrl = `/api/images/${fileName}`;

    return NextResponse.json({
      success: true,
      url: relativeUrl,
      fileName,
      localPath: targetFilePath,
    });
  } catch (err: any) {
    console.error('Error saving image locally to AppPics:', err);
    return NextResponse.json({ error: err.message || 'Failed to save local image' }, { status: 500 });
  }
}
