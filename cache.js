module.exports = function (func, timeoutMinutes) {
  let cacheList = [];
  return function() {
    const now = new Date();
    const args = Array.from(arguments);
    const cache = cacheList.find((x) => {
      const xArgs = x.args;
      let same = true;
      if (xArgs.length !== args.length) return false;
      for (let i = 0; i < xArgs.length; i++) {
        if (xArgs[i] !== args[i]) {
          same = false;
          break;
        }
      }
      return same;
    });
    if (!cache) {
      const result = func(...args);
      cacheList.push({
        args,
        result,
        timestamp: now,
      });
      return result;
    }
    const diffMinutes = ((now.getTime() - cache.timestamp.getTime()) / 1000) / 60;
    if (diffMinutes >= timeoutMinutes) {
      cache.timestamp = now;
      cache.result = func(...args);
    }
    return cache.result;
  }
};
