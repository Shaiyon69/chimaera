// Chimaera's installer is signed with a self-signed certificate, which Windows reports as
// "UnknownError" (untrusted root), so electron-updater's default check (Status === 0) would
// reject every update. Trust the exact signer certificate instead of the Windows trust store.
// Rotate before the certificate expires (October 2029): add the new thumbprint, ship, then drop the old.
export const PINNED_SIGNER_THUMBPRINTS = [
  "535DF8443C91E89C893753CBA2246F13332F2619",
];

// System.Management.Automation.SignatureStatus
const STATUS_VALID = 0;
const STATUS_UNKNOWN_ERROR = 1;

type SignatureResult = {
  Status?: number;
  SignerCertificate?: { Thumbprint?: string } | null;
};

/** Returns null when the update is signed by a pinned certificate, else the reason it is rejected. */
export const checkSignature = (
  json: string,
  pinned: string[] = PINNED_SIGNER_THUMBPRINTS
): string | null => {
  let result: SignatureResult;
  try {
    result = JSON.parse(json) as SignatureResult;
  } catch {
    return "Could not read the signature check result";
  }

  // A tampered file reports HashMismatch (3), never UnknownError, so only an intact
  // signature chaining to an untrusted root passes here.
  if (
    result.Status !== STATUS_VALID &&
    result.Status !== STATUS_UNKNOWN_ERROR
  ) {
    return `Signature status ${result.Status}`;
  }

  const thumbprint = result.SignerCertificate?.Thumbprint?.toUpperCase();
  if (!thumbprint || !pinned.some((p) => p.toUpperCase() === thumbprint)) {
    return `Signed by an unexpected certificate (${thumbprint ?? "none"})`;
  }

  return null;
};
