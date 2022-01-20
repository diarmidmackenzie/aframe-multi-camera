/* Component that handles the rendering of the viewpoint selector overlay
   When initialized, this exposes the following properties and functions:

     render(renderer) - call this during the render cycle to render the overlay.

   This component actually implements 3 separate functions:
   - Putting in place a secondary camera (see also: secondary-camera component)
   - Putting in place raycaster and cursor for that secondary camera.
   - Setting up the viewpoint-selectore entity in front of the secondary camera.

   It might be helpful to split out these functions into 3 separate components
   (as I have started to do with secondary-camera), so that they can each be
   used independently.  Under consideration for future evolution of this
   codebase...
*/
AFRAME.registerComponent('viewpoint-selector-renderer', {
    schema: {
        displayBox: {type: 'selector', default: '#viewpoint-selector-box'},
        cameraType: {type: 'string', oneOf: ['perspective, orthographic'], default: 'orthographic'},
        syncTarget: {type: 'selector'},
        layer: {type: 'number', default: 0},
        angleOffset: {type: 'vec3'},
        outer: {type: 'number', default: 1},
        inner: {type: 'number', default: 0.6},
        text: {type: 'color', default: '#000000'},
        color: {type: 'color', default: '#FFFFFF'},
        hoverColor: {type: 'color', default: '#BBBBBB'},
        animationTimer: {type: 'number', default: 500}
    },

    init() {

        this.savedViewport = new THREE.Vector4();
        this.sceneInfo = this.prepareScene();
        this.displayBox = this.data.displayBox;
        this.vr = this.el.sceneEl.is('vr-mode');

        // Add Viewpoint Selector to the scene, and ensure it is lit.
        this.viewpointSelector = document.createElement('a-entity');
        this.viewpointSelector.setAttribute('id', 'viewpoint-selector')
        this.viewpointSelector.setAttribute('viewpoint-selector',
                                        {syncTarget: `#${this.data.syncTarget.id}`,
                                         angleOffset: this.data.angleOffset,
                                         layer: this.data.layer,
                                         outer: this.data.outer,
                                         inner: this.data.inner,
                                         text: this.data.text,
                                         color: this.data.color,
                                         hoverColor: this.data.hoverColor,
                                         animationTimer: this.data.animationTimer
                                        });
        this.viewpointSelector.object3D.position.set(0 , 0, -2)
        this.el.sceneEl.appendChild(this.viewpointSelector);

        this.viewpointSelectorControls = document.createElement('a-entity');
        this.viewpointSelectorControls.setAttribute('id', 'viewpoint-selector-controls')
        this.viewpointSelectorControls.setAttribute("raycaster", "objects: .viewpointSelectorElement; interval: 100");
        //fuseTimeout: 0: workaround for  aframe bug on mobile device: device gets selected on scene loading (https://github.com/aframevr/aframe/issues/4141)
        this.viewpointSelectorControls.setAttribute("cursor", "rayOrigin: mouse; fuseTimeout: 0; canvas: user; camera: user");
        this.el.sceneEl.appendChild(this.viewpointSelectorControls);

        this.viewpointSelectorControls.addEventListener('loaded', () => {
            this.viewpointSelectorControls.components['raycaster'].raycaster.layers.set(this.data.layer);
            const cursor = this.viewpointSelectorControls.components['cursor'];
            cursor.removeEventListeners();
            cursor.camera = this.camera;
            cursor.canvas = this.displayBox;
            cursor.canvasBounds = cursor.canvas.getBoundingClientRect();
            cursor.addEventListeners();
            cursor.updateMouseEventListeners();

            // a resize event also helps get everything aligned.
            window.dispatchEvent(new Event('resize'));
        });

        // re-use main lighting - just ensure additional layer is set.
        enableObjectLayer = function(object, layer) {
            object.layers.enable(layer);
            object.children.forEach(o => enableObjectLayer(o, layer));
        }
        document.querySelectorAll('[light]').forEach(el => {
            enableObjectLayer(el.object3D, this.data.layer);
        });

        // add the render call to the scene
        // Since moving to add-render-call System (needed to support add/remove
        // of cameras), it seems this only works if I specify an identifier.
        // I don't really understand why, and haven't looked closely at this yet...
        // Added a note to the README.
        this.el.sceneEl.setAttribute('add-render-call__1',
                                     {entity: `#${this.el.id}`,
                                      componentName: "viewpoint-selector-renderer"});

        // listen for movement into / out of VR.
        this.el.sceneEl.addEventListener('enter-vr', this.enterVR.bind(this), false);
        this.el.sceneEl.addEventListener('exit-vr', this.exitVR.bind(this), false);
    },

    enterVR() {
        this.vr = true;

        // turn off viewpoint selector raycaster.  Rndering will also stop.
        this.viewpointSelectorControls.setAttribute('raycaster', 'enabled: false');
    },

    exitVR() {
        this.vr = false;

        // turn on viewpoint selector raycaster.  Rendering will also restart.
        this.viewpointSelectorControls.setAttribute('raycaster', 'enabled: true');
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

        this.camera.position.set(0, 0, 0);
        this.camera.lookAt(0, 0, 0);
        this.camera.layers.disableAll();
        this.camera.layers.set(this.data.layer);

        return;
    },

    render(renderer, renderFunction) {

        if (this.vr) return; // no Viewpoint Selector in VR.

        const elem = this.displayBox;

        // get the viewport relative position of this element
        const elemRect = elem.getBoundingClientRect();

        this.camera.aspect = elemRect.width / elemRect.height;
        this.camera.updateProjectionMatrix();

        // "bottom" position is relative to the whole viewport, not just the canvas.
        // We need to turn this into a distance from the bottom of the canvas.
        // We need to consider the header bar above the canvas, and the size of the canvas.
        const mainRect = renderer.domElement.getBoundingClientRect();

        renderer.getViewport(this.savedViewport);

        renderer.setViewport(elemRect.left - mainRect.left,
                             mainRect.bottom - elemRect.bottom,
                             elemRect.width,
                             elemRect.height);

        renderFunction.call(renderer, this.scene, this.camera);
        renderer.setViewport(this.savedViewport);
    }
});

AFRAME.registerComponent('viewpoint-selector', {

    schema: {
        outer: {type: 'number', default: 1},
        inner: {type: 'number', default: 0.6},
        text: {type: 'color', default: '#000000'},
        color: {type: 'color', default: '#FFFFFF'},
        hoverColor: {type: 'color', default: '#BBBBBB'},
        layer: {type: 'number', default: 0},
        syncTarget: {type: 'selector'},
        angleOffset: {type: 'vec3'},
        animationTimer: {type: 'number', default: 500}
    },

    init: function () {

        // quaternions to use when translating to/from groups.
        this.selectorToGroupQuaternion = new THREE.Quaternion();
        this.tempEuler = new THREE.Euler();        
        this.tempEuler.set(THREE.MathUtils.degToRad(this.data.angleOffset.x),
                           THREE.MathUtils.degToRad(this.data.angleOffset.y),
                           THREE.MathUtils.degToRad(this.data.angleOffset.z));
        this.selectorToGroupQuaternion.setFromEuler(this.tempEuler);
        this.groupToSelectorQuaternion = this.selectorToGroupQuaternion.clone().invert();

        this.animationTimer = 0;
        this.targetQuaternion = new THREE.Quaternion();

        this.hoverStart = this.hoverStart.bind(this);
        this.hoverEnd = this.hoverEnd.bind(this);
        this.click = this.click.bind(this);

        this.quaternion = new THREE.Quaternion();
        this.vector = new THREE.Vector3();
        this.defaultOrientation = new THREE.Vector3( 0, 0, 1 );

        const big = this.data.outer / 2;
        const small = this.data.inner / 2;
        frameCenter = (this.data.outer + this.data.inner) / 4;

        // Plane faces with text.
        this.front  = this.createPlane("FRONT",  `0 0  ${big}`, "  0   0   0");
        this.back   = this.createPlane("BACK",   `0 0 -${big}`, "  0 180   0");
        this.left   = this.createPlane("LEFT",   `-${big} 0 0`, "  0 -90   0");
        this.right  = this.createPlane("RIGHT",  ` ${big} 0 0`, "  0  90   0");
        this.top    = this.createPlane("TOP",    `0  ${big} 0`, "-90   0   0");
        this.bottom = this.createPlane("BOTTOM", `0 -${big} 0`, " 90   0   0");

        // cube corners.  "RTF" = Right, Top, Front etc. (matches x/y/z order)
        // R = Right, L = Left, B = Bottom, T = Top, F = Front, K = Back (avoids ambiguity with bottom").
        this.createCorner("RTF", ` ${frameCenter}  ${frameCenter}  ${frameCenter}`);
        this.createCorner("RTK", ` ${frameCenter}  ${frameCenter} -${frameCenter}`);
        this.createCorner("RBF", ` ${frameCenter} -${frameCenter}  ${frameCenter}`);
        this.createCorner("RBK", ` ${frameCenter} -${frameCenter} -${frameCenter}`);
        this.createCorner("LTF", `-${frameCenter}  ${frameCenter}  ${frameCenter}`);
        this.createCorner("LTK", `-${frameCenter}  ${frameCenter} -${frameCenter}`);
        this.createCorner("LBF", `-${frameCenter} -${frameCenter}  ${frameCenter}`);
        this.createCorner("LBK", `-${frameCenter} -${frameCenter} -${frameCenter}`);

        // edges - front
        this.createEdge("FT", `              0  ${frameCenter}  ${frameCenter}`, "   0   0   0");
        this.createEdge("FB", `              0 -${frameCenter}  ${frameCenter}`, "   0   0   0");
        this.createEdge("FR", ` ${frameCenter}               0  ${frameCenter}`, "   0   0  90");
        this.createEdge("FL",  `-${frameCenter}               0  ${frameCenter}`, "   0   0  90");

        // edges - middle
        this.createEdge("TR", ` ${frameCenter}  ${frameCenter}               0`, "   0  90   0");
        this.createEdge("BR", ` ${frameCenter} -${frameCenter}               0`, "   0  90   0");
        this.createEdge("TL", `-${frameCenter}  ${frameCenter}               0`, "   0  90   0");
        this.createEdge("BL", `-${frameCenter} -${frameCenter}               0`, "   0  90   0");

        // edges - back
        this.createEdge("KT", `              0  ${frameCenter} -${frameCenter}`, "   0   0   0");
        this.createEdge("KB", `              0 -${frameCenter} -${frameCenter}`, "   0   0   0");
        this.createEdge("KL", ` ${frameCenter}               0 -${frameCenter}`, "   0   0  90");
        this.createEdge("KR", `-${frameCenter}               0 -${frameCenter}`, "   0   0  90");


        // Initially tried automatically calculating rotations using
        //   quaternion.setFromUnitVectors(this.vector, this.defaultOrientation);
        // But this didn't give enough fine control in terms of final orientation
        // (as "up"/"down" don't hve any special status vs. other directions)
        // so it's simpler (and maximum control) to hard code
        // the angles for each position.
        this.angles = {
            "FRONT" : {x:   0, y:   0, z:   0},
            "BACK"  : {x:   0, y: 180, z:   0},
            "LEFT"  : {x:   0, y:  90, z:   0},
            "RIGHT" : {x:   0, y: -90, z:   0},
            "TOP"   : {x:  90, y:   0, z:   0},
            "BOTTOM": {x: -90, y:   0, z:   0},
            "FT"    : {x:  45, y:   0, z:   0},
            "FB"    : {x: -45, y:   0, z:   0},
            "FR"    : {x:   0, y: -45, z:   0},
            "FL"    : {x:   0, y:  45, z:   0},
            "KT"    : {x:  45, y: 180, z:   0},
            "KB"    : {x: -45, y: 180, z:   0},
            "KR"    : {x:   0, y: 135, z:   0},
            "KL"    : {x:   0, y: 225, z:   0},
            "TR"    : {x:  45, y: -90, z:   0},
            "BR"    : {x: -45, y: -90, z:   0},
            "TL"    : {x:  45, y:  90, z:   0},
            "BL"    : {x: -45, y:  90, z:   0},
            "RTF"   : {x:  45, y: -45, z:   0},
            "RTK"   : {x:  45, y: 225, z:   0},
            "RBF"   : {x: -45, y: -45, z:   0},
            "RBK"   : {x: -45, y: 225, z:   0},
            "LTF"   : {x:  45, y:  45, z:   0},
            "LTK"   : {x:  45, y: 135, z:   0},
            "LBF"   : {x: -45, y:  45, z:   0},
            "LBK"   : {x: -45, y: 135, z:   0},
        }
    },

    createPlane(text, position, rotation) {

        const plane = document.createElement('a-plane');
        plane.setAttribute('text', {value: text, color: this.data.text, wrapCount: 7, width: this.data.inner * 1.4, align: 'center'});
        plane.setAttribute('id', text);
        plane.setAttribute('class', 'viewpointSelectorElement');
        plane.setAttribute('position', position);
        plane.setAttribute('rotation', rotation);
        plane.setAttribute('width', this.data.inner);
        plane.setAttribute('height', this.data.inner);
        plane.setAttribute('material', {color: this.data.color});
        plane.setAttribute('layers', this.data.layer);

        this.el.appendChild(plane);
        this.addListenersToElement(plane);

        return plane;
    },

    createCorner(id, position) {

        const size = (this.data.outer - this.data.inner) / 2;

        const box = document.createElement('a-box');
        box.setAttribute('position', position);
        box.setAttribute('id', id);
        box.setAttribute('class', 'viewpointSelectorElement');
        box.setAttribute('width', size);
        box.setAttribute('height', size);
        box.setAttribute('depth', size);
        box.setAttribute('material', {color: this.data.color});
        box.setAttribute('layers', this.data.layer);

        this.el.appendChild(box);
        this.addListenersToElement(box);

        return box;
    },

    createEdge(id, position, rotation) {

        const size = (this.data.outer - this.data.inner) / 2;

        const box = document.createElement('a-box');
        box.setAttribute('position', position);
        box.setAttribute('id', id);
        box.setAttribute('class', 'viewpointSelectorElement');
        box.setAttribute('rotation', rotation);
        box.setAttribute('width', this.data.inner);
        box.setAttribute('height', size);
        box.setAttribute('depth', size);
        box.setAttribute('material', {color: this.data.color});
        box.setAttribute('layers', this.data.layer);

        this.el.appendChild(box);
        this.addListenersToElement(box);

        return box;
    },

    addListenersToElement: function(el) {

        el.addEventListener('mouseenter', this.hoverStart);
        el.addEventListener('mouseleave', this.hoverEnd);
        el.addEventListener('click', this.click);

    },

    hoverStart: function(event) {

        event.target.setAttribute("material", {color: this.data.hoverColor});

    },

    hoverEnd: function(event) {

        event.target.setAttribute("material", {color: this.data.color});

    },

    click: function(event) {

        /* Rather than rotating the viewpoint selector and syncing teh scen to it,
           Simpler to rotate the scene itself and rely on tick synchronization to rotate the viewpoint
           selector itself. */
        const id = event.target.id;

        angle = this.angles[id];

        this.tempEuler.set(THREE.Math.degToRad(angle.x),
                           THREE.Math.degToRad(angle.y),
                           THREE.Math.degToRad(angle.z))
        this.targetQuaternion.setFromEuler(this.tempEuler);
        this.targetQuaternion.multiply(this.selectorToGroupQuaternion);

        // Kick off the animation by setting a timer - animation handled in tick()
        // Don't use A-Frame animaton, because this forces us to use Euler's which
        // are unusable for this purpose.
        this.animationTimer = this.data.animationTimer;
    },

    tick(time, timeDelta) {

        // First part of tick is to apply any updates necessary to the target element.
        if (this.animationTimer > 0) {

            const factor = Math.min(timeDelta / this.animationTimer, 1);
            this.data.syncTarget.object3D.quaternion.slerp(this.targetQuaternion, factor)

            this.animationTimer -= timeDelta;
        }

        // Second part of tick processing is to sync the viewpoint selector to the target.
        if (this.data.syncTarget) {
            this.el.object3D.quaternion.copy(this.data.syncTarget.object3D.quaternion);
            this.el.object3D.quaternion.multiply(this.groupToSelectorQuaternion);
        }
    }
});
