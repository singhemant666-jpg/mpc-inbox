import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    // Look for sahil number test.xlsx in workspace root
    const possiblePaths = [
      path.join(process.cwd(), '..', 'sahil number test.xlsx'),
      path.join(process.cwd(), 'sahil number test.xlsx'),
      'c:/Users/DELL/Documents/mpc inbox/sahil number test.xlsx',
    ];

    let foundPath = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        foundPath = p;
        break;
      }
    }

    if (!foundPath) {
      return NextResponse.json(
        { success: false, error: 'Default file sahil number test.xlsx not found' },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(foundPath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json<any>(worksheet);

    const rows = rawData.map((r, index) => {
      // Find name key
      const nameKey = Object.keys(r).find((k) => /name/i.test(k)) || Object.keys(r)[0];
      // Find phone key
      const phoneKey =
        Object.keys(r).find((k) => /num|phone|mobile|contact/i.test(k)) || Object.keys(r)[1];

      const rawPhone = String(r[phoneKey] || '').replace(/\.0$/, '').trim();
      const name = String(r[nameKey] || '').trim();

      return {
        id: index + 1,
        name: name || `Customer ${index + 1}`,
        rawPhone,
      };
    });

    return NextResponse.json({
      success: true,
      filename: 'sahil number test.xlsx',
      count: rows.length,
      rows,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
