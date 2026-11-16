// WebAuthn helpers: convert between the JSON the server sends/expects (base64url) and the browser's ArrayBuffers.

const toBuf = (s) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
};
const toB64u = (buf) => {
  let bin = '';
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const passkeysSupported = () => !!(window.PublicKeyCredential && navigator.credentials);

export function creationOptions(o) {
  return {
    ...o,
    challenge: toBuf(o.challenge),
    user: { ...o.user, id: toBuf(o.user.id) },
    excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: toBuf(c.id) })),
  };
}

export function requestOptions(o) {
  return {
    ...o,
    challenge: toBuf(o.challenge),
    allowCredentials: (o.allowCredentials || []).map((c) => ({ ...c, id: toBuf(c.id) })),
  };
}

export function registrationJSON(cred) {
  return {
    id: cred.id,
    rawId: toB64u(cred.rawId),
    type: cred.type,
    authenticatorAttachment: cred.authenticatorAttachment || undefined,
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
    response: {
      clientDataJSON: toB64u(cred.response.clientDataJSON),
      attestationObject: toB64u(cred.response.attestationObject),
      transports: cred.response.getTransports ? cred.response.getTransports() : [],
    },
  };
}

export function authenticationJSON(cred) {
  return {
    id: cred.id,
    rawId: toB64u(cred.rawId),
    type: cred.type,
    authenticatorAttachment: cred.authenticatorAttachment || undefined,
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
    response: {
      clientDataJSON: toB64u(cred.response.clientDataJSON),
      authenticatorData: toB64u(cred.response.authenticatorData),
      signature: toB64u(cred.response.signature),
      userHandle: cred.response.userHandle ? toB64u(cred.response.userHandle) : undefined,
    },
  };
}
