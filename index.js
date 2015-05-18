
var rUrl = /\u001Frelative\u001F([\s\S]*?)\u001F/g;
var path = require('path');
var rFile = /\.[^\.]+$/;

function wrap(value) {
  return '\u001Frelative\u001F' + value + '\u001F';
}

function getRelativeUrl(file, host) {
  var url = file.getUrl();

  if (file.useDomain && file.domain) {
    return url;
  }

  url = file.url;

  if (file.useHash) {
    url = addHash(url, file);
  }

  var relativeFrom = typeof host.relative === 'string' ? host.relative : host.release;
  if (rFile.test(relativeFrom)) {
    relativeFrom = path.dirname(relativeFrom);
  }
  url = path.relative(relativeFrom, url);

  return url + file.query;
}

function convert(content, file, host) {
  return content.replace(rUrl, function(all, value) {
    var info = fis.project.lookup(value);
    var query = (info.file.query && info.query) ? '&' + info.query.substring(1) : info.query;
    var hash = info.hash || info.file.hash;
    var url = getRelativeUrl(info.file, host || file);

    return info.quote + url + query + hash + info.quote;
  });
}

function onStandardRestoreUri(message) {
  var value = message.value;
  var file = message.file;
  var info = message.info;

  // 没有配置，不开启。
  if (!file.relative) {
    return;
  }

  var query = (info.file.query && info.query) ? '&' + info.query.substring(1) : info.query;
  message.ret = wrap(info.quote + info.file.subpath + query + info.quote);
};

function onProcessEnd(file) {
  // 没有配置，不开启。
  if (!file.relative || !file.isText()) {
    return;
  }

  var content = file.getContent();
  file.relativeBody = content;
  content = convert(content, file);
  file.setContent(content);
}

function onPackFile(message) {
  var file = message.file;
  var content = message.content;
  var pkg = message.pkg;

  // 没有配置，不开启。
  if (!file.relative || !file.relativeBody) {
    return;
  }

  content = convert(file.relativeBody, file, pkg);
  message.content = content;
}

function onFetchRelativeUrl(message) {
  var target = message.target;
  var host = message.file;

  if (!target.relative) {
    return;
  }

  var url = getRelativeUrl(target, host);
  return url;
}

/**
 * 给文件添加md5标识符
 * @param {String} path 文件路径
 * @param {Object} file fis File对象
 * @return {String} 带有md5 hash标识的路径
 */
function addHash(path, file) {
  var rExt = file.rExt,
    qRExt = fis.util.escapeReg(rExt),
    qExt = fis.util.escapeReg(file.ext),
    hash = file.getHash(),
    onnector = fis.env().get('project.md5Connector', '_'),
    reg = new RegExp(qRExt + '$|' + qExt + '$', 'i');
  return path.replace(reg, '') + onnector + hash + rExt;
}

module.exports = function(fis, opts) {

  fis.on('proccess:end', onProcessEnd);
  fis.on('standard:restore:uri', onStandardRestoreUri);
  fis.on('pack:file', onPackFile);

  // 给其他插件用的
  fis.on('plugin:relative:fetch', onFetchRelativeUrl);
};