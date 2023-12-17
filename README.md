# aframe-multi-camera

<video src="https://user-images.githubusercontent.com/16045703/150434386-91181ba5-4162-4e15-a100-bf1576dba8ba.mp4" controls="controls" style="max-width: 730px;">
</video>



## Overview

This repository contains

- components that can be used to create multi-camera scenes in A-Frame.  Cameras can render to the canvas, or a to plane surface within the scene.
- components to create a viewpoint selector widget for a A-Frame scene being displayed in 2D.  This widget provides an intuitive interface that allows a user to jump to any viewing angle of an object, in 45 degree increments.  This is one example of how the multi-camera function can be used.

## Examples

We have the following examples:

#### Multiple Cameras

[Multiple cameras and canvases](https://diarmidmackenzie.github.io/aframe-multi-camera/examples/multi-screen.html)

[Cursor use across multiple secondary cameras](https://diarmidmackenzie.github.io/aframe-multi-camera/examples/multi-screen-with-cursor.html)

[Multiple camera views embedded in an HTML page without any background full-screen A-Frame scene](https://diarmidmackenzie.github.io/aframe-multi-camera/examples/embedded-views.html)

[Secondary cameras rendering to planes in the scene, to create a CCTV monitor effect](https://diarmidmackenzie.github.io/aframe-multi-camera/examples/camera-texture.html)

[Primary camera rendering to a plane in the scene, to create a CCTV monitor effect](https://diarmidmackenzie.github.io/aframe-multi-camera/examples/monitor-user-view.html)

[Mirrors rendered to planes in the scene](https://diarmidmackenzie.github.io/aframe-multi-camera/examples/mirror-example.html)

### Viewpoint Selector

A [basic example](https://diarmidmackenzie.github.io/aframe-multi-camera/examples/viewpoint-selector-basic.html) of a scene where the central objects can be manipulated using the viewpoint-selector: 

A [second example](https://diarmidmackenzie.github.io/aframe-multi-camera/examples/viewpoint-selector-alternate.html), demonstrating various different configuration options for the viewpoint selector.


## Components

The components in this repository are as follows:

- add-render-call - This is a generic component that supports extensions to the main A-Frame render cycle, allowing for rendering from multiple cameras, and to multiple canvases.
- secondary-camera - This is a generic component that uses add-render-call to support one or more secondary cameras, optionally also using a cursor.
- layers - This allows configuration of layers on objects.  Layers control whether an object can be seen by a camera, whether it is intersected with a raycaster etc.  They are used to allow the viewpoint selector to exist in the main A-Frame scene, without interfering with it.
- viewpoint-selector - This implements the cube-shaped selector itself.
- viewpoint-selector-renderer - This configures the viewpoint-selector, and the accompanying cursor, camera, lighting and renderer

The configuration options for each of these components are detailed below.

The following components are used to support examples.

- mouse-rotate-controls - A very simple utility component that allows an entity in a scene to be rotated by dragging the mouse (no configuration parameters).

- hover.  A very simple hove effect, used to demonstrate cursor controls in some of the examples. (no configuration parameters)

  

## Installation

There are 4 modules that you may need.

- To use secondary cameras at all, you need the `multi-camera.js` module from the `src` directory.
- To use mouse cursor on a secondary camera, you will also need the `cursor.js` module from the `src` directory (see note below).
- To use the viewpoint selector, you will need both of the above, and also the `viewpoint-selector`.js module from the `src` directory.
- To use mirrors, you just need the `mirror.js` module from the `src` directory

You can either download them and include them like this:

```
<script src="cursor.js"></script>
<script src="multi-camera.js"></script>
<script src="viewpoint-selector.js"></script>
<script src="mirror.js"></script>
```

Or via JSDelivr CDN (check the releases in the repo for the best version number to use)

```
<script src="https://cdn.jsdelivr.net/gh/diarmidmackenzie/aframe-multi-camera@latest/aframe/cursor.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/diarmidmackenzie/aframe-multi-camera@latest/src/multi-camera.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/diarmidmackenzie/aframe-multi-camera@latest/src/viewpoint-selector.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/diarmidmackenzie/aframe-multi-camera@latest/src/mirror.min.js"></script>	
```

Theses components are not yet available in npm.  If that would be useful to you, please raise an issue against the repo and I'll work on it...

#### A note on cursor.js

Using the mouse cursor on a canvas or camera that is not the main A-Frame canvas/camera depends upon a fix that is not yet available in any main A-Frame release (see [this PR](https://github.com/aframevr/aframe/pull/4983) for latest status on getting this into A-Frame.)

Therefore you will need to include the patched version of A-Frame `cursor.js` from the aframe directory of this project.  This module can be included in an HTML file after including A-Frame to patch `cursor.js`.



## Limitations

Here are some current limitations with these components.

- Various components have limited support for updates (i.e. changes to properties after initial creation).  I'm happy to fix issues like this up on a case by case basis - please raise an issue on the repository.  PRs for these fixes also welcome too!.
- Rendering in-scene (i.e. mirror and secondary cameras that are not rendering to screen) currently only render to planes.  Rendering to other flat shapes (circle, triangle, ring) should be straightforward - if someone raises an issue or PR I'll happily take a look.  Not sure about rendering to 3D surfaces - getting some texture in place is probably not too hard.  Getting physically accurate mirror reflections is probably *very* difficult!
- For rendering in-scene, there is no frustrum culling.  Textures are rendered whether or not they are actually in view of camera.
- Rendering to screen is intended for desktop only, and is not intended to be used in VR.  When in VR, rendering is skipped for secondary-cameras that render to screen (for rendering to a VR HUD, you can use rendering in-scene to a plane fixed directly in front of the camera).
- In VR (tested on Oculus Quest 2) , mirror textures seem to be extremely pixelated, regardless of "quality" settings.  I haven't yet understood why this is.
- Cursor controls cannot be used on mirror textures, or secondary cameras rendered to a plane - only to secondary cameras rendered to screen.  If you have specific use cases that need cursor on either of these, raise an issue and I will take a look at how hard this is.



## Components

#### add-render-call

This is a generic base component that supports extensions to the main A-Frame render cycle, allowing for rendering from multiple cameras, and to multiple canvases.

If you use `secondary-camera` or `viewpoint-selector-renderer`, they will set this up for you, and you don't need to worry about this component.

This could be added anywhere in the scene and should have the same effect, but typically it is added to the scene.  Multiple instances of this component can be added, in which case they will compound with each other, in the order that they are initialized in.

NOTE: for reasons unknown, it appears that this *doesn't* work unless it has an identifier - so add  specify as e.g. `add-render-call___1` rather than `add-render-call`

| Property      | Default value | Description                                                  |
| ------------- | ------------- | ------------------------------------------------------------ |
| entity        | none          | A DOM selector for an entity that has a component configured on it with a suitable render extension function. |
| componentName | none          | The name of the component on the entity that has a suitable render extension function. |
| sequence      | 'after'       | 'before', 'after' or 'replace'.  Determines whether the camera view is rendered before or after the main scene is rendered, or whether this camera replaces the main camera completely.<br />If 'replace' is set on any one secondary camera, this will mean that the main camera is not rendered. |

This component expects the specified entity / component to provide a suitable render extension function.

This takes the following form:

- It is available on the component as `this.render(renderer, renderFunction)`
- It is written to be called after the main A-Frame rendering is completed, to perform additional rendering steps.  It can and should assume that [`renderer.autoClear`](https://threejs.org/docs/index.html?q=webGLRen#api/en/renderers/WebGLRenderer.autoClear) has been set to `false`.
- It expects to be passed the following parameters:
  - `renderer`: The [THREE.WebGLRenderer](https://threejs.org/docs/index.html?q=webGLRen#api/en/renderers/WebGLRenderer) object being used to render the scene
  - `renderFunction`: The original [render()](https://threejs.org/docs/index.html?q=webGLRen#api/en/renderers/WebGLRenderer.render) function for this renderer, which can be used to perform any additional rendering required.  This should be used in place of `renderer.render()`, which has been co-opted by this component (and calling it would lead to infinite recursion)

For an example of a suitable render extension function, see `render()` in `viewpoint-selector-renderer`.

WARNING: removal of this component is currently bugged: see "Limitations".

#### secondary-camera

This is a generic component that uses add-render-call to support one or more secondary cameras, optionally also using a cursor.

| Property      | Default value | Description                                                  |
| ------------- | ------------- | ------------------------------------------------------------ |
| output        | 'screen'      | 'screen' or 'plane'.  Determines whether the camera output goes to screen, or to a plane within the scene. |
| outputElement | none          | The DOM element that camera output should be rendered to.  For output = 'screen', this is typically a HTML div outside the A-Frame scene, with suitable styling to set its position.<br />For output='plane' this should be an A-Frame entity of type `<a-plane>`.  It also needs to have the src parameter specified with a texture (any texture will do) - see examples. (I should be able to write some code to lift this restriction, but didn't do it yet!) |
| cameraType    | orthographic  | Either "orthographic" or "perspective".  Determines the type of camera used to render the viewpoint selector cube.  Other camera parameters (e.g. position, fov etc.) are not yet configurable. |
| sequence      | 'after'       | 'before', 'after' or 'replace'.  Determines whether the camera view is rendered before or after the main scene is rendered, or whether this camera replaces the main camera completely.<br />Typically set to 'after' when rendering to screen, and 'before' when rendering to a plane within the scene (so that the rendered plane is included in the final scene render).<br />If 'replace' is set on any one secondary camera, this will mean that the main camera is not rendered. |
| quality       | "high"        | Either "high" or "low".  Only applicable when output='plane'.   This determines the resolution used for the texture.  "low" quality results in a lower-resolution texture, where there will be more noticeable pixelation, but will support a higher frame-rate. |

This component provides generic second camera functionality in the scene.

In addition to the properties explicitly configured on the secondary-camera component, the secondary camera will also respond to the following components configured on the same entity.

| **Component** | Effect                                                       |
| ------------- | ------------------------------------------------------------ |
| position      | Used to control the position of the camera                   |
| rotation      | Used to to configure the orientation of the camera           |
| cursor        | If this is configured, it should be configured with the properties "camera: user; canvas: user".  The secondary camera will reconfigure the cursor and underlying raycaster to work with this camera and canvas.  Note that this functionality depends on an enhancement to cursor.js that is not in A-Frame yet.  See "Installation" above. |
| layer         | Used to set which layer the camera views.  If a cursor component is configured on this entity, the underlying raycaster will also be configured to use the same layer.  (WARNING: I didn't test this function yet.  Hopefully it works!) |

See the examples for how secondary-camera can be used.



#### layers

This allows configuration of layers on objects.  Layers control whether an object can be seen by a camera, whether it is intersected with a raycaster etc.  They are used to allow the viewpoint selector to exist in the main A-Frame scene, without interfering with it.

It takes a single un-named property, 

See [the THREE.js docs](https://threejs.org/docs/index.html?q=layers#api/en/core/Layers ) for more background on Layers.

NOTE: Layer 0 is the default layer.  In VR, layers 1 & 2 are reserved for the left & right eyes respectively.  So if you want to use custom layers, it's best to use layer 3+.

#### viewpoint-selector 

This implements the cube-shaped selector itself.  If you use viwpoint-selector-renderer, this sets up viewpoint-selector, and you won't need to use this component directly.

| Property       | Default value        | Description                                                  |
| -------------- | -------------------- | ------------------------------------------------------------ |
| outer          | 1                    | The dimension (in metres) of the rotating cube.              |
| inner          | 0.6                  | The dimension (in metres) of the inner faces of the  cube.   |
| text           | #000000 (black)      | The color used for the text on the cube                      |
| color          | #FFFFFF (white)      | The color used for the cube itself                           |
| hoverColor     | #BBBBBB (light grey) | The color used for the cube segments when the mouse hovers over them |
| layer          | 0                    | The layer used to render the viewpoint selector.  Lighting, camera and raycaster must all also use this layer. |
| syncTarget     | None                 | A DOM selector for a target that should have its rotation synchronized with the viewpoint-selector.  Typically this target will be a wrapper for all the objects you want to control with the viewpoint selector.  When this target moves, the viewpoint selector moves to match it.  When segments of the viewpoint selector are clicked, the viewpoint selector rotates and the target rotates with it. |
| angleOffset    | 0 0 0                | An angle offset between the viewpoint selector and the syncTarget.  Specify this when the default (zero) rotation for the target is not "0 0 0".  The viewpoint selector will maintain this offset between itself and the target. |
| animationTimer | 500                  | The time in msecs taken to rotate to a new fixed position after the user clicks on a segment of the viewpoint selector. |



#### viewpoint-selector-renderer

This configures the viewpoint-selector, and the accompanying cursor, camera, lighting and renderer.

Much of the code here is similar to secondary-camera, and this component could probably be rewritten to use secondary-camera (in which case it could become a lot simpler).

| Property            | Default value           | Description                                                  |
| ------------------- | ----------------------- | ------------------------------------------------------------ |
| displayBox          | #viewpoint-selector-box | A DOM selector for an HTML element which should be used as a canvas to render the viewpoint-selector. |
| cameraType          | orthographic            | Either "orthographic" or "perspective".  Determines the type of camera used to render the viewpoint selector cube.  Other camera parameters (e.g. position, fov etc.) are not yet configurable. |
| other parameters... | various, see above.     | These parameters are used to configure the viewpoint-selector itself.  See above for details. |



#### mirror

This can be used to configure one side of an `<a-plane>`entity to act as a mirror.  This is not currently supported on any other primitive (though it should also work on an `<a-entity>` that is set up with a plane geometry)

| Property | Default value | Description                                                  |
| -------- | ------------- | ------------------------------------------------------------ |
| quality  | "high"        | Either "high" or "low".  This determines the resolution used for the texture.  "low" quality results in a lower-resolution texture, where there will be more noticeable pixelation, but will support a higher frame-rate. |



In addition to the properties explicitly configured on the mirror component, the plane should be configured as follows:

- For an opaque-backed mirror: `side` or `material.side` should be set to `back`.  Other `material` parameters should be set to  whatever material effect is desired for the mirror back.
- For a mirror that is invisible when viewed from behind, set `opacity` or `material.opacity` to 0.



## Acknowledgments

The `viewpoint selector` and `viewpoint-selector-renderer` components were originally developed in collaboration with Virtonomy (https://virtonomy.io), and formed the foundation for several other components in this repository.

I am grateful to them for giving me permission to release these components as Open Source under the MIT License.

The `mirror` component is just a thin wrapper around the THREE.js `Reflector` class, as can be seen in [this example](https://threejs.org/examples/webgl_mirror.html).



## Implementation Notes

#### Single vs. multiple WebGL Contexts

Some solutions for secondary cameras that I have seen elsewhere use multiple WebGL contexts (i.e. multiple canvases) to achieve the necessary rendering.

E.g. https://jgbarah.github.io/aframe-playground/camrender-01/

(based on: https://wirewhiz.com/how-to-use-a-cameras-output-as-a-texture-in-aframe/...)

In these components, I've avoided using multiple WebGL Contexts, instead using a single WebGL context, but invoking the render() method multiple times.

With multiple WebGL contexts, the scene, geometry, textures etc. all need to be uploaded to the GPU for each context, which certainly increases memory usage, and I suspect impacts performance as well.

I don't honestly know how great the benefits of using a single WebGL Context are, but I think there ought to be at least some benefit.  Maybe I'll try to do some performance comparisons at some point.

Note that even using a single WebGL context, there's still a draw call required for every object, on every camera, so secondary cameras do have a significant performance hit even when using just a single WebGL context - but hopefully less than it would have been otherwise.


#### add-render-call vs. onBeforeRender()

The mirror component uses THREE.js `object3D.onBeforeRender()` callbacks, rather than using the `add-render-call` component.

I've experimented with using `object3DonBeforeRender()` for `secondary-camera` but hit issues with recursive `render()` calls that I couldn't easily solve.  I haven't yet understood why the mirror component doesn't hit the same problems.

However I'm interested to see whether moving mirror to use `add-render-call` might help with the highly pixelated textures in VR (see "Limitations").


#### add-render-call vs. tick()

The [aframe-playground](https://jgbarah.github.io/aframe-playground/camrender-01/) example mentioned above uses the tick() function to perform the pre-rendering to textures.

I've been wondering whether add-render-call is over-complicated, and instead of using this for rendering "before" and "after" the main render step, we could just use the tick(0 and tock() methods already offered by A-Frame - which would be somewhat simpler.

So far I'm not inclined t make that change.  Key reasons being:

- If we used tick() and tock() processing for the additional render steps, this would get mixed up in terms of scheduling with any other tick() and tock() processing going on in the scene.  By inserting the additional processing into the main render() call for the scene, we avoid any issues that might arise when other components' tick() or tock() method acts before we have finished rendering.
- By keeping all render calls together, the add-render-call simplifies tracking rendering statistics (as used in the A-Frame stats component), including correctly counting draw calls..  Given that additional cameras do have a significant performance impact, I think it's useful to be able to track accurate statistics for the render processing.
  

## Tests

As well as the examples folder, there is also a tests folder.

This contains modified versions of examples, in order to test specific functions (so far I've focussed on cleanly adding / removing secondary cameras).

These are not in the main examples folder, as they don't offer any particular additional "how to" insight.

