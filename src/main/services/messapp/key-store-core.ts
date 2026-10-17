import fs from "node:fs";

export interface KeyCipher {
  available: () => boolean;
  encrypt: (text: string) => Buffer;
  decrypt: (data: Buffer) => string;
}

/** Keeps one secret per user, encrypted at rest by the injected cipher (OS keystore in the app). */
export const createKeyStore = (filePath: string, cipher: KeyCipher) => {
  const read = (): Record<string, string> => {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return {};
    }
  };

  const write = (entries: Record<string, string>) =>
    fs.writeFileSync(filePath, JSON.stringify(entries), { mode: 0o600 });

  return {
    /** False when the OS cannot encrypt; the caller then keeps the key in memory only. */
    save: (userId: string, secret: string) => {
      if (!cipher.available()) return false;

      write({
        ...read(),
        [userId]: cipher.encrypt(secret).toString("base64"),
      });
      return true;
    },

    load: (userId: string) => {
      const blob = read()[userId];
      if (!blob || !cipher.available()) return null;

      try {
        return cipher.decrypt(Buffer.from(blob, "base64"));
      } catch {
        return null;
      }
    },

    clear: (userId: string) => {
      const { [userId]: _removed, ...rest } = read();
      write(rest);
    },
  };
};
