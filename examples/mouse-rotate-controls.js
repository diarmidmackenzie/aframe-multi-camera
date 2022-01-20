/* Basic mouse cvontrols to rotate.  Derived from
   A-Frame Example: https://aframe.io/examples/showcase/modelviewer/
   But with some significant changes to improve rotation stability */
AFRAME.registerComponent('mouse-rotate-controls', {

  init: function () {

    this.xQuaternion = new THREE.Quaternion();
    this.yQuaternion = new THREE.Quaternion();
    this.yAxis = new THREE.Vector3();
    this.xAxis = new THREE.Vector3(1, 0, 0);
    this.unusedVector = new THREE.Vector3();

    // Mouse 2D controls.
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mousedown', this.onMouseDown);
  },

  onMouseDown: function (evt) {
    this.oldClientX = evt.clientX;
    this.oldClientY = evt.clientY;
  },

  onMouseUp: function (evt) {
    if (evt.buttons === undefined || evt.buttons !== 0) { return; }
    this.oldClientX = undefined;
    this.oldClientY = undefined;
  },

  onMouseMove: function (evt) {
    this.rotateModel(evt);
  },

  rotateModel: function (evt) {
    var dX;
    var dY;

    if (!this.oldClientX) { return; }
    dX = this.oldClientX - evt.clientX;
    dY = this.oldClientY - evt.clientY;

    // xAxis for rotation is fixed.
    // yAxis comes from target object.
    this.el.object3D.matrix.extractBasis(this.unusedVector, this.yAxis, this.unusedVector);
    this.xQuaternion.setFromAxisAngle(this.yAxis, -dX / 400)
    this.yQuaternion.setFromAxisAngle(this.xAxis, -dY / 400)

    this.el.object3D.quaternion.premultiply(this.xQuaternion);
    this.el.object3D.quaternion.premultiply(this.yQuaternion);

    this.oldClientX = evt.clientX;
    this.oldClientY = evt.clientY;
  }
});

AFRAME.registerComponent('hover', {

  init() {
    this.el.addEventListener("mouseenter", this.hover.bind(this));
    this.el.addEventListener("mouseleave", this.unhover.bind(this));
  },

  hover() {
    this.el.setAttribute("material", "emissive: #fff; emissiveIntensity: 0.2")
  },

  unhover() {
    this.el.setAttribute("material", "emissive: #000; emissiveIntensity: 0")
  }
});
