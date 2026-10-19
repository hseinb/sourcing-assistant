import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LOCAL_APP_PICS_DIR = 'C:\\Users\\hussi\\Desktop\\China\\AppPics';

export async function GET(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const fileName = params.filename;
    // Sanitize filename to avoid directory traversal
    const safeFileName = path.basename(fileName);
    const filePath = path.join(LOCAL_APP_PICS_DIR, safeFileName);

    if (!fs.existsSync(filePath)) {
      return new NextResponse('Image not found', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: any) {
    console.error('Error serving local image:', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
