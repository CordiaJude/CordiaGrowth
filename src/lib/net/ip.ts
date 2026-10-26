import { BlockList, isIPv4, isIPv6 } from "node:net";

// Addresses a crawler must never reach: loopback, private, link-local
// (incl. cloud metadata at 169.254.169.254), CGNAT, multicast, reserved and
// documentation ranges.
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

/** Extracts an embedded IPv4 address from IPv4-mapped/compatible or NAT64 IPv6. */
function embeddedIPv4(ip: string): string | null {
  const m = /^(?:::ffff:|::|64:ff9b::)(?:0:)?(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (m) return m[1];
  const hex = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ip);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return null;
}

export function isPublicIp(ip: string): boolean {
  if (isIPv4(ip)) return !blocked.check(ip, "ipv4");
  if (isIPv6(ip)) {
    const v4 = embeddedIPv4(ip);
    if (v4) return isPublicIp(v4);
    return !blocked.check(ip, "ipv6");
  }
  return false;
}
