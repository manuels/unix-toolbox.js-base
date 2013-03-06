(function(exports){
  var Promise = function() {
    var callbacks = [];
    var result = null;

    this.then = function(cb) {
      if(result !== null)
        cb.apply(this, result);
      else
        callbacks.push(cb);

      return this;
    };

    this.fulfil = function() {
      result = arguments;
      for(var i in callbacks) {
        callbacks[i].apply(this, result);
      }
    }
  };


  exports.Interface = function(worker_script) {
    this.worker = new Worker(worker_script);
    this.promises = [];
    var self = this;


    this.worker.onmessage = function(ev) {
      var obj;
      try{
        obj = JSON.parse(ev.data);
      }
      catch(e) {
        return;
      }

      if('id' in obj)
        self.promises[obj.id].fulfil(obj);
      if(obj.cmd) {
        if(obj.cmd == 'stdout' && typeof(self.on_stdout) === 'function')
          self.on_stdout(obj.contents+'\n')
        if(obj.cmd == 'stderr' && typeof(self.on_stderr) === 'function')
          self.on_stderr(obj.contents+'\n')
      }
    };


    /*
     * Download a url and import the file into the virtual filesystem
     *
     * real_url:    Url to download
     * pseudo_path: Destination path in the virtual fs
                    if it ends with a slash, the original file name will appended
       mkdir:       Boolean, create pseudo_path if it does not exist (default: false)
     *
     * returns a Promise
     */
    this.addUrl = function(real_url, pseudo_path, mkdir) {
      mkdir = mkdir || false;

      var opt_filename = this._analysePath(real_url).filename;
      var dst = this._analysePath(pseudo_path, opt_filename);

      var prom = new Promise();
      self.promises.push(prom);

      var payload = function() {
        self.worker.postMessage(JSON.stringify({
          cmd:         'addUrl',
          id:          (self.promises.length-1),
          real_url:    real_url,
          pseudo_path: dst.path,
          pseudo_name: dst.filename
        }))
      };

      if(mkdir)
        self.mkdir(dst.path).then(payload);
      else
        payload();

      return prom;
    },


    self._analysePath = function(path_in, opt_filename) {
      var is_absolute = (path_in[0] === '/');
      var is_path_only = (path_in[path_in.length-1] === '/');

      var filename, path;
      if(is_path_only) {
        filename = opt_filename || '';
        path = path_in;
      }
      else {
        var elements = path_in.split('/');
        filename = elements[elements.length-1];
        path = path_in.substr(0, path_in.length-filename.length);
      }
      return {
        filename: filename,
        path:     path
      };
    }


    self.mkdir = function(pseudo_path) {
      var prom = new Promise();
      self.promises.push(prom);
      self.worker.postMessage(JSON.stringify({
        cmd:         'mkdir',
        id:          (self.promises.length-1),
        pseudo_path: '/',
        pseudo_name: pseudo_path
      }));

      return prom;
    },


    self.getFiles = function() {
      var prom = new Promise();
      var contents = {};

      var pseudo_files = Array.prototype.slice.call(arguments);
      for(var i in pseudo_files)
        (function(fname) {
          self.getFile(fname).then(function(c) {
            contents[fname] = c;
            if(Object.keys(contents).length == pseudo_files.length)
              prom.fulfil(contents);
          });
        })(pseudo_files[i]);

      return prom;
    }


    self.getFile = function(pseudo_file) {
      var file = self._analysePath(pseudo_file);

      var prom1 = new Promise();
      self.promises.push(prom1);
      self.worker.postMessage(JSON.stringify({
        cmd:         'getFile',
        id:          (self.promises.length-1),
        pseudo_path: file.path,
        pseudo_name: file.filename
      }));

      var prom2 = new Promise();
      var chunks = [];
      prom1.then(function(msg) {
        var id = msg.chunk_id;
        chunks[id] = msg.contents;

        var complete = true;
        for(var i = 0; i < msg.chunk_count; i++) {
          if(typeof(chunks[i]) === 'undefined') {
            complete = false;
            break;
          }
        }

        if(complete) {
          prom2.fulfil(chunks.join(''), file.path, file.filename);
        }
      });

      return prom2;
    },


    this.addData = function(contents, pseudo_path) {
      var dst = self._analysePath(pseudo_path);

      var prom = new Promise();
      self.promises.push(prom);
      self.worker.postMessage(JSON.stringify({
        cmd:         'addData',
        id:          (self.promises.length-1),
        contents:    contents,
        pseudo_path: dst.path,
        pseudo_name: dst.filename
      }));
      return prom;
    },


    this.allDone = function() {
      var prom = new Promise();

      var N = this.promises.length;
      for(var i = 0; i < this.promises.length; i++) {
        this.promises[i].then(function() {
          N--;
          if(N == 0)
            prom.fulfil();
        });
      }
      if(this.promises.length === 0)
        prom.fulfil();

      return prom;
    }


    this.run = function() {
      var prom = new Promise();
      self.promises.push(prom);

      var args = [];
      for(var i = 0; i < arguments.length; i++)
        args.push(arguments[i]);

      self.worker.postMessage(JSON.stringify({
        cmd:         'run',
        id:          (self.promises.length-1),
        args:        args
      }));

      return prom;
    }

    exports.Interface.Promise = Promise;
    return this;
  }
})(window);
