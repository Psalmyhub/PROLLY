import dns from "dns";

const originalLookup = dns.lookup;

dns.lookup = function (hostname, options, callback) {
  if (hostname === "studio.genlayer.com") {
    if (typeof options === "function") {
      return options(null, "172.67.210.182", 4);
    }

    if (options && options.all) {
      return callback(null, [
        { address: "172.67.210.182", family: 4 }
      ]);
    }

    return callback(null, "172.67.210.182", 4);
  }

  return originalLookup.call(dns, hostname, options, callback);
};
