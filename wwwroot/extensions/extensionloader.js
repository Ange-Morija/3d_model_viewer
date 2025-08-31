// extensionloader.js - fixed & robust loader
$(document).ready(function() {

  loadJSON(init);

  // Load configuration JSON and call callback(config)
  function loadJSON(callback) {
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open('GET', 'extensions/config.json', true);
    xobj.onreadystatechange = function () {
      if (xobj.readyState === 4) {
        if (xobj.status === 200) {
          try {
            callback(JSON.parse(xobj.responseText));
          } catch (err) {
            console.error("extensionloader: failed to parse config.json", err);
          }
        } else {
          console.error("extensionloader: failed to load config.json, status:", xobj.status);
        }
      }
    };
    xobj.send(null);
  }

  function init(config) {
    if (!config || !Array.isArray(config.Extensions)) {
      console.error('extensionloader: invalid or missing Extensions in config.json');
      return;
    }

    var Extensions = config.Extensions;
    var loaderconfig = { initialload: false, Viewer: null };

    // helper: create or return element with given id
    function ensureElementExists(id) {
      if (!id) return null;
      let el = document.getElementById(id);
      if (!el) {
        console.warn(`extensionloader: element with id "${id}" not found — creating placeholder.`);
        el = document.createElement('div');
        el.id = id;
        el.style.display = 'none';
        document.body.appendChild(el);
      }
      return el;
    }

    // Helper to append external dependency (css or js)
    function loadExternalDependency(dep) {
      if (!dep || !dep.type || !dep.link) return;
      try {
        if (dep.type === 'js') {
          const s = document.createElement('script');
          s.type = 'text/javascript';
          s.src = dep.link;
          s.defer = true;
          document.getElementsByTagName('head')[0].appendChild(s);
          console.log('extensionloader: appended external js', dep.link);
        } else if (dep.type === 'css') {
          const l = document.createElement('link');
          l.rel = 'stylesheet';
          l.href = dep.link;
          document.getElementsByTagName('head')[0].appendChild(l);
          console.log('extensionloader: appended external css', dep.link);
        }
      } catch (err) {
        console.error('extensionloader: failed to append external dependency', dep, err);
      }
    }

    // Preload externaldependencies (if present)
    Extensions.forEach(element => {
      if (Array.isArray(element.externaldependencies)) {
        element.externaldependencies.forEach(dep => loadExternalDependency(dep));
      }
    });

    // Preload files listed in filestoload for each extension
    Extensions.forEach(element => {
      const path = "extensions/" + element.name + "/contents/";
      if (element.filestoload && Array.isArray(element.filestoload.cssfiles)) {
        element.filestoload.cssfiles.forEach(file => loadjscssfile(path + file, 'css'));
      }
      if (element.filestoload && Array.isArray(element.filestoload.jsfiles)) {
        element.filestoload.jsfiles.forEach(file => loadjscssfile(path + file, 'js'));
      }
    });

    // Custom events from viewer
    document.addEventListener('loadextension', function(e) {
      console.log('extensionloader: loadextension', e && e.detail);
      const extName = e && e.detail && e.detail.extension;
      const v = e && e.detail && e.detail.viewer ? e.detail.viewer : loaderconfig.Viewer;
      if (!extName) { console.warn('extensionloader: no extension specified'); return; }
      if (!v) { console.warn('extensionloader: viewer not available to load', extName); return; }
      try {
        v.loadExtension(extName);
        console.log('extensionloader: requested loadExtension ->', extName);
      } catch (err) {
        console.error('extensionloader: loadExtension failed for', extName, err);
      }
    });

    document.addEventListener('unloadextension', function(e) {
      const extName = e && e.detail && e.detail.extension;
      const v = e && e.detail && e.detail.viewer ? e.detail.viewer : loaderconfig.Viewer;
      if (!extName || !v) return;
      try { v.unloadExtension(extName); } catch (err) { console.error(err); }
    });

    document.addEventListener('viewerinstance', function(e) {
      console.log('extensionloader: viewerinstance received');
      loaderconfig.Viewer = e.detail.viewer;
      if (!loaderconfig.initialload) {
        loadStartupExtensions();
        loaderconfig.initialload = true;
      }

      // safely show ListConfig.ListId (create placeholder if missing)
      const listId = config.ListConfig && config.ListConfig.ListId ? config.ListConfig.ListId : null;
      if (listId) {
        const listElm = ensureElementExists(listId);
        if (listElm) listElm.style.display = 'block';
      } else {
        console.warn('extensionloader: no ListConfig.ListId in config.json');
      }

      if (config.InbuiltExtensionsConfig && config.InbuiltExtensionsConfig.CreateList === "true") {
        ListInbuiltExtensions(config);
      }
      if (config.ListConfig && config.ListConfig.CreateList === "true") {
        CreateList(config, Extensions);
      }
    });

    function loadStartupExtensions() {
      Extensions.forEach(element => {
        if (element.loadonstartup === "true") {
          if (loaderconfig.Viewer) {
            loaderconfig.Viewer.loadExtension(element.name);
            console.log('extensionloader: auto-loaded', element.name);
          } else console.warn('extensionloader: viewer not set when attempting to autoload', element.name);
        }
      });
    }

    function CreateList(config, Extensions) {
      var list = ensureElementExists(config.ListConfig.ListId);
      if (!list) return;
      var ExtensionList = '';
      let index = 0;
      Extensions.forEach(element => {
        if (element.includeinlist === "true") {
          let name = element.name;
          let checked = (element.loadonstartup === 'true') ? ' checked ' : '';
          let editoptions = (element.editoptions === 'true') ? '&nbsp;<i class="fas fa-cog editoptions" data-index="'+index+'" data-toggle="modal" data-target="#editConfigModal"></i>' : '';
          ExtensionList += '<label><input class="checkextension" type="checkbox"'+checked+' name="'+name+'" value="'+name+'" data-index="'+index+'"> '+(element.displayname||name)+'</label>&nbsp;<i class="fas fa-info-circle details" data-toggle="popover" ></i>'+editoptions+'<br>';
        }
        index++;
      });
      list.innerHTML = ExtensionList;

      // setup popovers / handlers
      var checkbox = document.getElementsByClassName('checkextension');
      for (var i=0; i < checkbox.length; i++) {
        checkbox.item(i).onclick = togglecustomextension;
        let idx = checkbox.item(i).attributes['data-index'].value;
        let element = Extensions[idx];
        let moredetails = element.bloglink ? '<a target="_blank" href="'+element.bloglink+'">Learn more</a>' : '';
        let gif = element.gif ? '<br><img src="./extensions/'+element.name+'/extension.gif" alt="Sample Image">' : '';
        let contents = '<p>' + (element.description||'') + '</p>' + moredetails + gif;
        $(checkbox.item(i).parentNode).next().popover({
          html: true, container: 'body', boundary: 'viewport',
          title: (element.displayname||element.name), placement:'left', content: contents
        });
      }

      let editbuttons = document.getElementsByClassName('editoptions');
      for (var j=0; j < editbuttons.length; j++) {
        let idx = editbuttons.item(j).attributes['data-index'].value;
        editbuttons.item(j).onclick = function(e) {
          const index = parseInt(e.target.getAttribute('data-index'), 10);
          const element = Extensions[index];
          document.getElementById("editextensionconfig") && (document.getElementById("editextensionconfig").value = JSON.stringify(element.options || {}, null, 2));
          document.getElementById("learnmore") && document.getElementById("learnmore").setAttribute('href', element.bloglink || '#');
        };
      }

      document.getElementById("saveconfig") && (document.getElementById("saveconfig").onclick = function() {
        console.log('saveconfig clicked');
      });

      function togglecustomextension(e) {
        const checked = e.target.checked;
        const extName = e.target.value;
        const idx = parseInt(e.target.dataset.index, 10);
        if (checked) loaderconfig.Viewer && loaderconfig.Viewer.loadExtension(extName, Extensions[idx].options);
        else loaderconfig.Viewer && loaderconfig.Viewer.unloadExtension(extName);
      }
    }

    function ListInbuiltExtensions(config) {
      let exts = config.InbuiltExtensions || [];
      let list = ensureElementExists(config.InbuiltExtensionsConfig.ListId);
      if (!list) return;
      let html = '';
      exts.forEach(el => {
        if (el.includeinlist !== "false") {
          let checked = (el.default === 'true') ? ' checked ' : '';
          html += '<label><input class="checkextensionbuiltin" type="checkbox"'+checked+' name="'+el.name+'" value="'+el.name+'"> '+(el.name.slice(9) || el.name)+'</label><br>';
        }
      });
      list.innerHTML = html;
      let checkbox = document.getElementsByClassName('checkextensionbuiltin');
      for (var i=0;i<checkbox.length;i++) {
        checkbox.item(i).onclick = function(e) {
          if (e.target.checked) loaderconfig.Viewer && loaderconfig.Viewer.loadExtension(e.target.value);
          else loaderconfig.Viewer && loaderconfig.Viewer.unloadExtension(e.target.value);
        }
      }
    }

    function loadjscssfile(filename, filetype) {
      var fileref;
      if (filetype === "js") {
        fileref = document.createElement('script');
        fileref.type = 'text/javascript';
        fileref.src = filename;
        fileref.defer = true;
      } else if (filetype === "css") {
        fileref = document.createElement('link');
        fileref.rel = 'stylesheet';
        fileref.type = 'text/css';
        fileref.href = filename;
      }
      if (typeof fileref !== "undefined") {
        document.getElementsByTagName("head")[0].appendChild(fileref);
        console.log('extensionloader: appended', filename);
      }
    }

  } // end init

}); // end document.ready
