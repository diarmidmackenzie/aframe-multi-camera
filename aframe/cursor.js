/* Replacement cursor.js component
   For use with A-Frame until PR-4983 is released: https://github.com/aframevr/aframe/pull/4983
   Based on the following version of A-Frame cursor.js
   https://github.com/aframevr/aframe/blob/25f09c11f84a60f5c078b112154688ccbadf20ff/src/components/cursor.js

   Use as follows:
   <script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>
   <script src="cursor.js"></script>
*/

const utils = AFRAME.utils;
const bind = utils.bind;

var EVENTS = {
  CLICK: 'click',
  FUSING: 'fusing',
  MOUSEENTER: 'mouseenter',
  MOUSEDOWN: 'mousedown',
  MOUSELEAVE: 'mouseleave',
  MOUSEUP: 'mouseup'
};

var STATES = {
  FUSING: 'cursor-fusing',
  HOVERING: 'cursor-hovering',
  HOVERED: 'cursor-hovered'
};

var CANVAS_EVENTS = {
  DOWN: ['mousedown', 'touchstart'],
  UP: ['mouseup', 'touchend']
};

var WEBXR_EVENTS = {
  DOWN: ['selectstart'],
  UP: ['selectend']
};

var CANVAS_HOVER_CLASS = 'a-mouse-cursor-hover';

/**
 * Cursor component. Applies the raycaster component specifically for starting the raycaster
 * from the camera and pointing from camera's facing direction, and then only returning the
 * closest intersection. Cursor can be fine-tuned by setting raycaster properties.
 *
 * @member {object} fuseTimeout - Timeout to trigger fuse-click.
 * @member {Element} cursorDownEl - Entity that was last mousedowned during current click.
 * @member {object} intersection - Attributes of the current intersection event, including
 *         3D- and 2D-space coordinates. See: http://threejs.org/docs/api/core/Raycaster.html
 * @member {Element} intersectedEl - Currently-intersected entity. Used to keep track to
 *         emit events when unintersecting.
 */
delete AFRAME.components['cursor']
AFRAME.registerComponent('cursor', {
  dependencies: ['raycaster'],

  schema: {
    downEvents: {default: []},
    fuse: {default: utils.device.isMobile()},
    fuseTimeout: {default: 1500, min: 0},
    mouseCursorStylesEnabled: {default: true},
    upEvents: {default: []},
    rayOrigin: {default: 'entity', oneOf: ['mouse', 'entity']},
    canvas: {default: 'auto', oneOf: ['auto', 'user']},
    camera: {default: 'auto', oneOf: ['auto', 'user']}
  },

  init: function () {
    var self = this;

    this.fuseTimeout = undefined;
    this.cursorDownEl = null;
    this.intersectedEl = null;
    this.canvasBounds = document.body.getBoundingClientRect();
    this.isCursorDown = false;

    // expose camera and cursor to user if required.
    if (this.data.camera === 'user') {
      this.camera = this.el.sceneEl.camera;
    }
    if (this.data.canvas === 'user') {
      this.canvas = this.el.sceneEl.canvas;
      this.canvasBounds = this.canvas.getBoundingClientRect();
    }

    // Debounce.
    this.updateCanvasBounds = utils.debounce(function updateCanvasBounds () {
      self.canvasBounds = self.getCanvas().getBoundingClientRect();
    }, 500);

    this.eventDetail = {};
    this.intersectedEventDetail = {cursorEl: this.el};

    // Bind methods.
    this.onCursorDown = bind(this.onCursorDown, this);
    this.onCursorUp = bind(this.onCursorUp, this);
    this.onIntersection = bind(this.onIntersection, this);
    this.onIntersectionCleared = bind(this.onIntersectionCleared, this);
    this.onMouseMove = bind(this.onMouseMove, this);
    this.onEnterVR = bind(this.onEnterVR, this);

    // Variables used in raycasting.  One set of these needed per-cursor
    // instance.
    this.direction = new THREE.Vector3();
    this.origin = new THREE.Vector3();
    this.rayCasterConfig = {origin: this.origin, direction: this.direction};
  },

  update: function (oldData) {
    if (this.data.rayOrigin === oldData.rayOrigin) { return; }
    this.updateMouseEventListeners();
  },

  play: function () {
    this.addEventListeners();
  },

  pause: function () {
    this.removeEventListeners();
  },

  remove: function () {
    var el = this.el;
    el.removeState(STATES.HOVERING);
    el.removeState(STATES.FUSING);
    clearTimeout(this.fuseTimeout);
    if (this.intersectedEl) { this.intersectedEl.removeState(STATES.HOVERED); }
    this.removeEventListeners();
  },

  addEventListeners: function () {
    var canvas;
    var data = this.data;
    var el = this.el;
    var self = this;

    const addCanvasListeners = () => {
      canvas = this.getCanvas();
      if (data.downEvents.length || data.upEvents.length) { return; }
      CANVAS_EVENTS.DOWN.forEach(function (downEvent) {
        canvas.addEventListener(downEvent, self.onCursorDown);
      });
      CANVAS_EVENTS.UP.forEach(function (upEvent) {
        canvas.addEventListener(upEvent, self.onCursorUp);
      });
    };

    canvas = this.getCanvas();
    if (canvas) {
      addCanvasListeners();
    } else {
      el.sceneEl.addEventListener('render-target-loaded', addCanvasListeners);
    }

    data.downEvents.forEach(function (downEvent) {
      el.addEventListener(downEvent, self.onCursorDown);
    });
    data.upEvents.forEach(function (upEvent) {
      el.addEventListener(upEvent, self.onCursorUp);
    });
    el.addEventListener('raycaster-intersection', this.onIntersection);
    el.addEventListener('raycaster-closest-entity-changed', this.onIntersection);

    el.addEventListener('raycaster-intersection-cleared', this.onIntersectionCleared);

    el.sceneEl.addEventListener('rendererresize', this.updateCanvasBounds);
    el.sceneEl.addEventListener('enter-vr', this.onEnterVR);
    window.addEventListener('resize', this.updateCanvasBounds);
    window.addEventListener('scroll', this.updateCanvasBounds);

    this.updateMouseEventListeners();
  },

  removeEventListeners: function () {
    var canvas;
    var data = this.data;
    var el = this.el;
    var self = this;

    canvas = this.getCanvas();
    if (canvas && !data.downEvents.length && !data.upEvents.length) {
      CANVAS_EVENTS.DOWN.forEach(function (downEvent) {
        canvas.removeEventListener(downEvent, self.onCursorDown);
      });
      CANVAS_EVENTS.UP.forEach(function (upEvent) {
        canvas.removeEventListener(upEvent, self.onCursorUp);
      });
    }

    data.downEvents.forEach(function (downEvent) {
      el.removeEventListener(downEvent, self.onCursorDown);
    });
    data.upEvents.forEach(function (upEvent) {
      el.removeEventListener(upEvent, self.onCursorUp);
    });
    el.removeEventListener('raycaster-intersection', this.onIntersection);
    el.removeEventListener('raycaster-intersection-cleared', this.onIntersectionCleared);
    canvas.removeEventListener('mousemove', this.onMouseMove);
    canvas.removeEventListener('touchstart', this.onMouseMove);
    canvas.removeEventListener('touchmove', this.onMouseMove);

    el.sceneEl.removeEventListener('rendererresize', this.updateCanvasBounds);
    el.sceneEl.removeEventListener('enter-vr', this.onEnterVR);
    window.removeEventListener('resize', this.updateCanvasBounds);
    window.removeEventListener('scroll', this.updateCanvasBounds);
  },

  updateMouseEventListeners: function () {
    var canvas;
    var el = this.el;

    canvas = this.getCanvas();
    canvas.removeEventListener('mousemove', this.onMouseMove);
    canvas.removeEventListener('touchmove', this.onMouseMove);
    el.setAttribute('raycaster', 'useWorldCoordinates', false);
    if (this.data.rayOrigin !== 'mouse') { return; }
    canvas.addEventListener('mousemove', this.onMouseMove, false);
    canvas.addEventListener('touchmove', this.onMouseMove, false);
    el.setAttribute('raycaster', 'useWorldCoordinates', true);
    this.updateCanvasBounds();
  },

  onMouseMove: (function () {
    var mouse = new THREE.Vector2();

    return function (evt) {
      var bounds = this.canvasBounds;
      var camera = this.getCamera();
      var left;
      var point;
      var top;

      camera.parent.updateMatrixWorld();

      // Calculate mouse position based on the canvas element
      if (evt.type === 'touchmove' || evt.type === 'touchstart') {
        // Track the first touch for simplicity.
        point = evt.touches.item(0);
      } else {
        point = evt;
      }

      left = point.clientX - bounds.left;
      top = point.clientY - bounds.top;
      mouse.x = (left / bounds.width) * 2 - 1;
      mouse.y = -(top / bounds.height) * 2 + 1;

      if (camera && camera.isPerspectiveCamera) {
        this.origin.setFromMatrixPosition(camera.matrixWorld);
        this.direction.set(mouse.x, mouse.y, 0.5).unproject(camera).sub(this.origin).normalize();
      } else if (camera && camera.isOrthographicCamera) {
        this.origin.set(mouse.x, mouse.y, (camera.near + camera.far) / (camera.near - camera.far)).unproject(camera); // set origin in plane of camera
        this.direction.set(0, 0, -1).transformDirection(camera.matrixWorld);
      } else {
        console.error('AFRAME.Raycaster: Unsupported camera type: ' + camera.type);
      }

      this.el.setAttribute('raycaster', this.rayCasterConfig);
      if (evt.type === 'touchmove') { evt.preventDefault(); }
    };
  })(),

  /**
   * Trigger mousedown and keep track of the mousedowned entity.
   */
  onCursorDown: function (evt) {
    this.isCursorDown = true;
    // Raycast again for touch.
    if (this.data.rayOrigin === 'mouse' && evt.type === 'touchstart') {
      this.onMouseMove(evt);
      this.el.components.raycaster.checkIntersections();
      evt.preventDefault();
    }

    this.twoWayEmit(EVENTS.MOUSEDOWN);
    this.cursorDownEl = this.intersectedEl;
  },

  /**
   * Trigger mouseup if:
   * - Not fusing (mobile has no mouse).
   * - Currently intersecting an entity.
   * - Currently-intersected entity is the same as the one when mousedown was triggered,
   *   in case user mousedowned one entity, dragged to another, and mouseupped.
   */
  onCursorUp: function (evt) {
    if (!this.isCursorDown) { return; }

    this.isCursorDown = false;

    var data = this.data;
    this.twoWayEmit(EVENTS.MOUSEUP);

    // If intersected entity has changed since the cursorDown, still emit mouseUp on the
    // previously cursorUp entity.
    if (this.cursorDownEl && this.cursorDownEl !== this.intersectedEl) {
      this.intersectedEventDetail.intersection = null;
      this.cursorDownEl.emit(EVENTS.MOUSEUP, this.intersectedEventDetail);
    }

    if ((!data.fuse || data.rayOrigin === 'mouse') &&
        this.intersectedEl && this.cursorDownEl === this.intersectedEl) {
      this.twoWayEmit(EVENTS.CLICK);
    }

    this.cursorDownEl = null;
    if (evt.type === 'touchend') { evt.preventDefault(); }
  },

  /**
   * Handle intersection.
   */
  onIntersection: function (evt) {
    var currentIntersection;
    var cursorEl = this.el;
    var index;
    var intersectedEl;
    var intersection;

    // Select closest object, excluding the cursor.
    index = evt.detail.els[0] === cursorEl ? 1 : 0;
    intersection = evt.detail.intersections[index];
    intersectedEl = evt.detail.els[index];

    // If cursor is the only intersected object, ignore the event.
    if (!intersectedEl) { return; }

    // Already intersecting this entity.
    if (this.intersectedEl === intersectedEl) { return; }

    // Ignore events further away than active intersection.
    if (this.intersectedEl) {
      currentIntersection = this.el.components.raycaster.getIntersection(this.intersectedEl);
      if (currentIntersection && currentIntersection.distance <= intersection.distance) { return; }
    }

    // Unset current intersection.
    this.clearCurrentIntersection(true);

    this.setIntersection(intersectedEl, intersection);
  },

  /**
   * Handle intersection cleared.
   */
  onIntersectionCleared: function (evt) {
    var clearedEls = evt.detail.clearedEls;
    // Check if the current intersection has ended
    if (clearedEls.indexOf(this.intersectedEl) === -1) { return; }
    this.clearCurrentIntersection();
  },

  onEnterVR: function () {
    this.clearCurrentIntersection(true);
    var xrSession = this.el.sceneEl.xrSession;
    var self = this;
    if (!xrSession) { return; }
    if (this.data.rayOrigin === 'mouse') { return; }
    WEBXR_EVENTS.DOWN.forEach(function (downEvent) {
      xrSession.addEventListener(downEvent, self.onCursorDown);
    });
    WEBXR_EVENTS.UP.forEach(function (upEvent) {
      xrSession.addEventListener(upEvent, self.onCursorUp);
    });
  },

  setIntersection: function (intersectedEl, intersection) {
    var cursorEl = this.el;
    var data = this.data;
    var self = this;

    // Already intersecting.
    if (this.intersectedEl === intersectedEl) { return; }

    // Set new intersection.
    this.intersectedEl = intersectedEl;

    // Hovering.
    cursorEl.addState(STATES.HOVERING);
    intersectedEl.addState(STATES.HOVERED);
    this.twoWayEmit(EVENTS.MOUSEENTER);

    if (this.data.mouseCursorStylesEnabled && this.data.rayOrigin === 'mouse') {
      this.getCanvas().classList.add(CANVAS_HOVER_CLASS);
    }

    // Begin fuse if necessary.
    if (data.fuseTimeout === 0 || !data.fuse) { return; }
    cursorEl.addState(STATES.FUSING);
    this.twoWayEmit(EVENTS.FUSING);
    this.fuseTimeout = setTimeout(function fuse () {
      cursorEl.removeState(STATES.FUSING);
      self.twoWayEmit(EVENTS.CLICK);
    }, data.fuseTimeout);
  },

  clearCurrentIntersection: function (ignoreRemaining) {
    var index;
    var intersection;
    var intersections;
    var cursorEl = this.el;

    // Nothing to be cleared.
    if (!this.intersectedEl) { return; }

    // No longer hovering (or fusing).
    this.intersectedEl.removeState(STATES.HOVERED);
    cursorEl.removeState(STATES.HOVERING);
    cursorEl.removeState(STATES.FUSING);
    this.twoWayEmit(EVENTS.MOUSELEAVE);

    if (this.data.mouseCursorStylesEnabled && this.data.rayOrigin === 'mouse') {
      this.getCanvas().classList.remove(CANVAS_HOVER_CLASS);
    }

    // Unset intersected entity (after emitting the event).
    this.intersectedEl = null;

    // Clear fuseTimeout.
    clearTimeout(this.fuseTimeout);

    // Set intersection to another raycasted element if any.
    if (ignoreRemaining === true) { return; }
    intersections = this.el.components.raycaster.intersections;
    if (intersections.length === 0) { return; }
    // Exclude the cursor.
    index = intersections[0].object.el === cursorEl ? 1 : 0;
    intersection = intersections[index];
    if (!intersection) { return; }
    this.setIntersection(intersection.object.el, intersection);
  },

  /**
   * Helper to emit on both the cursor and the intersected entity (if exists).
   */
  twoWayEmit: function (evtName) {
    var el = this.el;
    var intersectedEl = this.intersectedEl;
    var intersection;

    intersection = this.el.components.raycaster.getIntersection(intersectedEl);
    this.eventDetail.intersectedEl = intersectedEl;
    this.eventDetail.intersection = intersection;
    el.emit(evtName, this.eventDetail);

    if (!intersectedEl) { return; }

    this.intersectedEventDetail.intersection = intersection;
    intersectedEl.emit(evtName, this.intersectedEventDetail);
  },

  getCanvas: function () {
    if (this.data.canvas === 'user') {
      return this.canvas;
    } else {
      return this.el.sceneEl.canvas;
    }
  },

  getCamera: function () {
    if (this.data.camera === 'user') {
      return this.camera;
    } else {
      return this.el.sceneEl.camera;
    }
  }
});
