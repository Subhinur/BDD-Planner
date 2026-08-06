function isAllowedExternalUrl(url) {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

module.exports = { isAllowedExternalUrl };
