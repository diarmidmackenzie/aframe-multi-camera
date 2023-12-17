/* System that supports capture of the the main A-Frame render() call
   by add-render-call */
AFRAME.registerSystem('add-render-call', {

  init() {

    this.render = this.render.bind(this);
    this.originalRender = this.el.sceneEl.renderer.render;
    this.el.sceneEl.renderer.render = this.render;
    this.el.sceneEl.renderer.autoClear = false;

    this.preRenderCalls = [];
    this.postRenderCalls = [];
    this.suppresssDefaultRenderCount = 0;
  },

  addPreRenderCall(render) {
    this.preRenderCalls.push(render)
  },

  removePreRenderCall(render) {
    const index = this.preRenderCalls.indexOf(render);
    if (index > -1) {
      this.preRenderCalls.splice(index, 1);
    }
  },

  addPostRenderCall(render) {
    this.postRenderCalls.push(render)
  },

  removePostRenderCall(render) {
    const index = this.postRenderCalls.indexOf(render);
    if (index > -1) {
      this.postRenderCalls.splice(index, 1);
    }
    else {
      console.warn("Unexpected failure to remove render call")
    }
  },

  suppressOriginalRender() {
    this.suppresssDefaultRenderCount++;
  },

  unsuppressOriginalRender() {
    this.suppresssDefaultRenderCount--;

    if (this.suppresssDefaultRenderCount < 0) {
      console.warn("Unexpected unsuppression of original render")
      this.suppresssDefaultRenderCount = 0;
    }
  },

  render(scene, camera) {

    renderer = this.el.sceneEl.renderer

    if (scene !== this.el.sceneEl.object3D || 
        camera != this.el.sceneEl.camera) {
      // Render call is for a different scene (e.g. generating a texture from a cubemap)
      // or not the main camera.
      // Don't apply any pre- or post-render calls, just let the rendere function as
      // normal.
      this.originalRender.call(renderer, scene, camera)
      return
    }

    // set up THREE.js stats to correctly count across all render calls.
    renderer.info.autoReset = false;
    renderer.info.reset();

    this.preRenderCalls.forEach((f) => f());

    if (this.suppresssDefaultRenderCount <= 0) {
      this.originalRender.call(renderer, scene, camera)
    }

    this.postRenderCalls.forEach((f) => f());
  }
});

/* Component that captures the main A-Frame render() call
   and adds an additional render call.
   Must specify an entity and component that expose a function call render(). */
AFRAME.registerComponent('add-render-call', {

  multiple: true,

  schema: {
    entity: {type: 'selector'},
    componentName: {type: 'string'},
    sequence: {type: 'string', oneOf: ['before', 'after', 'replace'], default: 'after'}
  },

  init() {

    this.invokeRender = this.invokeRender.bind(this);

  },

  update(oldData) {

    // first clean up any old settings.
    this.removeSettings(oldData)

    // now add new settings.
    if (this.data.sequence === "before") {
        this.system.addPreRenderCall(this.invokeRender)
    }

    if (this.data.sequence === "replace") {
        this.system.suppressOriginalRender()
    }

    if (this.data.sequence === "after" ||
        this.data.sequence === "replace")
     {
      this.system.addPostRenderCall(this.invokeRender)
    }
  },

  remove() {
    this.removeSettings(this.data)
  },

  removeSettings(data) {
    if (data.sequence === "before") {
        this.system.removePreRenderCall(this.invokeRender)
    }

    if (data.sequence === "replace") {
        this.system.unsuppressOriginalRender()
    }

    if (data.sequence === "after" ||
        data.sequence === "replace")
     {
      this.system.removePostRenderCall(this.invokeRender)
    }
  },

  invokeRender()
  {
    const componentName = this.data.componentName;
    if ((this.data.entity) &&
        (this.data.entity.components[componentName])) {
        this.data.entity.components[componentName].render(this.el.sceneEl.renderer, this.system.originalRender);
    }
  }
});

/* Component to set layers via HTML attribute. */
AFRAME.registerComponent('layers', {
    schema : {type: 'number', default: 0},

    init: function() {

        setObjectLayer = function(object, layer) {
            if (!object.el ||
                !object.el.hasAttribute('keep-default-layer')) {
                object.layers.set(layer);
            }
            object.children.forEach(o => setObjectLayer(o, layer));
        }

        this.el.addEventListener("loaded", () => {
            setObjectLayer(this.el.object3D, this.data);
        });

        if (this.el.hasAttribute('text')) {
            this.el.addEventListener("textfontset", () => {
                setObjectLayer(this.el.object3D, this.data);
            });
        }
    }
});

/* This component has code in common with viewpoint-selector-renderer
   However it's a completely generic stripped-down version, which
   just delivers the 2nd camera function.
   i.e. it is missing:
   - The positioning of the viewpoint-selector entity.
   - The cursor / raycaster elements.
*/

AFRAME.registerComponent('secondary-camera', {
    schema: {
        output: {type: 'string', oneOf: ['screen', 'plane'], default: 'screen'},
        outputElement: {type: 'selector'},
        cameraType: {type: 'string', oneOf: ['perspective, orthographic'], default: 'perspective'},
        sequence: {type: 'string', oneOf: ['before', 'after', 'replace'], default: 'after'},
        quality: {type: 'string', oneOf: ['high, low'], default: 'high'}
    },

    init() {

        if (!this.el.id) {
          console.error("No id specified on entity.  secondary-camera only works on entities with an id")
        }

        this.savedViewport = new THREE.Vector4();
        this.savedScissorTest = false;
        this.savedScissor = new THREE.Vector4();
        this.outputRectangle = new THREE.Vector4();
        this.sceneInfo = this.prepareScene();
        this.activeRenderTarget = 0;



        // add the render call to the scene
        this.el.sceneEl.setAttribute(`add-render-call__${this.el.id}`,
                                     {entity: `#${this.el.id}`,
                                      componentName: "secondary-camera",
                                      sequence: this.data.sequence});

        // if there is a cursor on this entity, set it up to read this camera.
        if (this.el.hasAttribute('cursor')) {
          this.el.setAttribute("cursor", "canvas: user; camera: user");

          this.el.addEventListener('loaded', () => {
                this.el.components['raycaster'].raycaster.layers.mask = this.el.object3D.layers.mask;

                const cursor = this.el.components['cursor'];
                cursor.removeEventListeners();
                cursor.camera = this.camera;
                cursor.canvas = this.data.outputElement;
                cursor.canvasBounds = cursor.canvas.getBoundingClientRect();
                cursor.addEventListeners();
                cursor.updateMouseEventListeners();
            });
        }

        if (this.data.output === 'plane') {
          if (!this.data.outputElement.hasLoaded) {
            this.data.outputElement.addEventListener("loaded", () => {
              this.configureCameraToPlane()
            });
          } else {
            this.configureCameraToPlane()
          }
        }
    },

    configureCameraToPlane() {
      const object = this.data.outputElement.getObject3D('mesh');
      function nearestPowerOf2(n) {
        return 1 << 31 - Math.clz32(n);
      }
      // 2 * nearest power of 2 gives a nice look, but at a perf cost.
      const factor = (this.data.quality === 'high') ? 2 : 1;

      const width = factor * nearestPowerOf2(window.innerWidth * window.devicePixelRatio);
      const height = factor * nearestPowerOf2(window.innerHeight * window.devicePixelRatio);

      function newRenderTarget() {
        const target = new THREE.WebGLRenderTarget(width,
                                                   height,
                                                   {
                                                      minFilter: THREE.LinearFilter,
                                                      magFilter: THREE.LinearFilter,
                                                      stencilBuffer: false,
                                                      generateMipmaps: false
                                                    });

         return target;
      }
      // We use 2 render targets, and alternate each frame, so that we are
      // never rendering to a target that is actually in front of the camera.
      this.renderTargets = [newRenderTarget(),
                            newRenderTarget()]

      this.camera.aspect = object.geometry.parameters.width /
                           object.geometry.parameters.height;

    },

    remove() {

      this.el.sceneEl.removeAttribute(`add-render-call__${this.el.id}`);
      if (this.renderTargets) {
        this.renderTargets[0].dispose();
        this.renderTargets[1].dispose();
      }

      // "Remove" code does not tidy up adjustments made to cursor component.
      // rarely necessary as cursor is typically put in place at the same time
      // as the secondary camera, and so will be disposed of at the same time.
    },

    prepareScene() {
        this.scene = this.el.sceneEl.object3D;

        const width = 2;
        const height = 2;

        if (this.data.cameraType === "orthographic") {
            this.camera = new THREE.OrthographicCamera( width / - 2, width / 2, height / 2, height / - 2, 1, 1000 );
        }
        else {
            this.camera = new THREE.PerspectiveCamera( 45, width / height, 1, 1000);
        }

        this.scene.add(this.camera);
        return;
    },

    render(renderer, renderFunction) {

        // don't bother rendering to screen in VR mode.
        if (this.data.output === "screen" && this.el.sceneEl.is('vr-mode')) return;

        var elemRect;

        if (this.data.output === "screen") {
           const elem = this.data.outputElement;

           // get the viewport relative position of this element
           elemRect = elem.getBoundingClientRect();
           this.camera.aspect = elemRect.width / elemRect.height;
        }

        // Camera position & layers match this entity.
        this.el.object3D.getWorldPosition(this.camera.position);
        this.el.object3D.getWorldQuaternion(this.camera.quaternion);
        this.camera.layers.mask = this.el.object3D.layers.mask;

        this.camera.updateProjectionMatrix();

        if (this.data.output === "screen") {
          // "bottom" position is relative to the whole viewport, not just the canvas.
          // We need to turn this into a distance from the bottom of the canvas.
          // We need to consider the header bar above the canvas, and the size of the canvas.
          const mainRect = renderer.domElement.getBoundingClientRect();

          renderer.getViewport(this.savedViewport);
          this.savedScissorTest = renderer.getScissorTest();
          renderer.getScissor(this.savedScissor);

          this.outputRectangle.set(elemRect.left - mainRect.left,
                                   mainRect.bottom - elemRect.bottom,
                                   elemRect.width,
                                   elemRect.height);
          renderer.setViewport(this.outputRectangle);
          renderer.setScissorTest(true);
          renderer.setScissor(this.outputRectangle);

          renderFunction.call(renderer, this.scene, this.camera);
          renderer.setViewport(this.savedViewport);
          renderer.setScissorTest(this.savedScissorTest);
          renderer.setScissor(this.savedScissor);
        }
        else {
          // target === "plane"

          // store off current renderer properties so that they can be restored.
          const currentRenderTarget = renderer.getRenderTarget();
          const currentXrEnabled = renderer.xr.enabled;
          const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;

          // temporarily override renderer properties for rendering to a texture.
          renderer.xr.enabled = false; // Avoid camera modification
          renderer.shadowMap.autoUpdate = false; // Avoid re-computing shadows

          const renderTarget = this.renderTargets[this.activeRenderTarget];
          renderTarget.texture.encoding = renderer.outputEncoding;
          renderer.setRenderTarget(renderTarget);
          renderer.state.buffers.depth.setMask( true ); // make sure the depth buffer is writable so it can be properly cleared, see #18897
          renderer.clear();

          renderFunction.call(renderer, this.scene, this.camera);

          this.data.outputElement.getObject3D('mesh').material.map = renderTarget.texture;

          // restore original renderer settings.
          renderer.setRenderTarget(currentRenderTarget);
          renderer.xr.enabled = currentXrEnabled;
          renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;

          this.activeRenderTarget = 1 - this.activeRenderTarget;
        }
    }
});
