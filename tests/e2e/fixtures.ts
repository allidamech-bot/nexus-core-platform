import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface E2eFixturePaths {
  root: string;
  validZip: string;
  invalidText: string;
  suspiciousZip: string;
}

const FIXTURE_ROOT = path.join(process.cwd(), ".e2e-fixtures");

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(input: Buffer) {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function makeZip(entries: Array<{ name: string; content: string }>) {
  const fileRecords: Buffer[] = [];
  const centralRecords: Buffer[] = [];
  let offset = 0;
  const { dosDate, dosTime } = dosDateTime();

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const content = Buffer.from(entry.content, "utf8");
    const checksum = crc32(content);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    fileRecords.push(localHeader, name, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralRecords.push(centralHeader, name);

    offset += localHeader.length + name.length + content.length;
  }

  const centralDirectory = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...fileRecords, centralDirectory, end]);
}

export async function ensureE2eFixtures(): Promise<E2eFixturePaths> {
  await mkdir(FIXTURE_ROOT, { recursive: true });

  const validZip = path.join(FIXTURE_ROOT, "small-valid-project.zip");
  const invalidText = path.join(FIXTURE_ROOT, "invalid-not-zip.txt");
  const suspiciousZip = path.join(FIXTURE_ROOT, "suspicious-paths.zip");

  await writeFile(
    validZip,
    makeZip([
      {
        name: "package.json",
        content: JSON.stringify({
          name: "small-valid-project",
          version: "1.0.0",
          scripts: { typecheck: "tsc --noEmit" },
          dependencies: {},
        }),
      },
      {
        name: "README.md",
        content: "# Small Valid Project\n\nSafe fixture for Nexus Core ingestion QA.\n",
      },
      {
        name: "src/index.ts",
        content: 'export function hello() { return "hello fixture"; }\n',
      },
    ]),
  );

  await writeFile(invalidText, "This is not a ZIP archive.\n", "utf8");

  await writeFile(
    suspiciousZip,
    makeZip([
      { name: "../evil.txt", content: "path traversal fixture\n" },
      { name: "/absolute.txt", content: "absolute path fixture\n" },
    ]),
  );

  return {
    root: FIXTURE_ROOT,
    validZip,
    invalidText,
    suspiciousZip,
  };
}

export async function cleanupE2eFixtures() {
  await rm(FIXTURE_ROOT, { recursive: true, force: true });
}
