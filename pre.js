var is_browser = (typeof(self) !== "undefined" || typeof(window) !== "undefined");

var FS;
this['Module'] = {
  'noInitialRun': is_browser,
};
var Module = this['Module'];

if(is_browser) {
  Module['print'] = function(a) { self['postMessage'](JSON.stringify({'cmd': 'stdout', 'contents': a})); }
  Module['printErr'] = function(a) { self['postMessage'](JSON.stringify({'cmd': 'stderr', 'contents': a})); }
}


Module['preInit'] = function() {
  Module['FS_root'] = function() {
    return FS.root.contents;
  }
};

var addUrl = function(id, real_url, pseudo_path, pseudo_name) {
  var xhr = new XMLHttpRequest;
  xhr.onload = function(ev) {
    if(xhr.readyState == 4){
      var byteArray = new Uint8Array(xhr['response']);
      Module['FS_createDataFile'](pseudo_path, pseudo_name, byteArray, true, true);
      self.postMessage(JSON.stringify({'id': id}));
    }
  };
  xhr.open("GET", real_url, true);
  xhr.responseType = "arraybuffer"; 
  xhr.send(null);
};


var addData = function(id, data, pseudo_path, pseudo_name) {
  Module['FS_createDataFile'](pseudo_path, pseudo_name, data, true, true);
  self.postMessage(JSON.stringify({'id': id}));
};


var mkdir = function(id, pseudo_path, pseudo_name) {
  Module['FS_createPath'](pseudo_path, pseudo_name, true, true);
  self.postMessage(JSON.stringify({'id': id}));
};


var getFile = function(id, pseudo_path, pseudo_name) {
  var array = FS.root.contents[pseudo_name].contents;
  var binary_data = new Uint8Array(array);

  var chunk_size = 1000;
  var chunk_count = Math.ceil(binary_data.length/chunk_size);
  
  for(var i = 0; i < chunk_count; i++) {
    var chunk = binary_data.subarray(i*chunk_size, Math.min((i+1)*chunk_size, binary_data.length));

    var str_chunk = String['fromCharCode'].apply(null, chunk);
    self.postMessage(JSON.stringify({'id': id, 'chunk_id': i, 'chunk_count': chunk_count, 'contents': str_chunk}));
  }
};


self['onmessage'] = function(ev) {
  var msg = JSON.parse(ev['data']);

  if(msg['cmd'] === 'addUrl') {
    addUrl(msg['id'], msg['real_url'], msg['pseudo_path'], msg['pseudo_name']);
  }

  if(msg['cmd'] === 'addData') {
    addData(msg['id'], msg['contents'], msg['pseudo_path'], msg['pseudo_name']);
  }

  if(msg['cmd'] === 'mkdir') {
    mkdir(msg['id'], msg['pseudo_path'], msg['pseudo_name']);
  }

  if(msg['cmd'] === 'run') {
    try {
      Module['run'](msg['args']);
    }
    catch(e) {
      self['postMessage'](JSON.stringify({'id': msg['id'], 'error': e.toString()}));
      return;
    }
    self['postMessage'](JSON.stringify({'id': msg['id'], 'success': true}));
  }

  if(msg['cmd'] === 'getFile') {
    getFile(msg['id'], msg['pseudo_path'], msg['pseudo_name']);
  }
};

