/* This code comes from THREE.js
https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Reflector.js
*/

const	Color = THREE.Color;
const	Matrix4 = THREE.Matrix4;
const	Mesh = THREE.Mesh;
const	PerspectiveCamera = THREE.PerspectiveCamera;
const	Plane = THREE.Plane;
const	ShaderMaterial = THREE.ShaderMaterial;
const	UniformsUtils = THREE.UniformsUtils;
const	Vector3 = THREE.Vector3;
const	Vector4 = THREE.Vector4;
const	WebGLRenderTarget = THREE.WebGLRenderTarget;
const HalfFloatType = THREE.HalfFloatType;
const NoToneMapping = THREE.NoToneMapping;
const LinearEncoding = THREE.LinearEncoding;

class Reflector extends Mesh {

	constructor( geometry, options = {} ) {

		super( geometry );

		this.isReflector = true;

		this.type = 'Reflector';
		this.camera = new PerspectiveCamera();

		const scope = this;

		const color = ( options.color !== undefined ) ? new Color( options.color ) : new Color( 0x7F7F7F );
		const textureWidth = options.textureWidth || 512;
		const textureHeight = options.textureHeight || 512;
		const clipBias = options.clipBias || 0;
		const shader = options.shader || Reflector.ReflectorShader;
		const multisample = ( options.multisample !== undefined ) ? options.multisample : 4;

		//

		const reflectorPlane = new Plane();
		const normal = new Vector3();
		const reflectorWorldPosition = new Vector3();
		const cameraWorldPosition = new Vector3();
		const rotationMatrix = new Matrix4();
		const lookAtPosition = new Vector3( 0, 0, - 1 );
		const clipPlane = new Vector4();

		const view = new Vector3();
		const target = new Vector3();
		const q = new Vector4();

		const textureMatrix = new Matrix4();
		const virtualCamera = this.camera;

		const renderTarget = new WebGLRenderTarget( textureWidth, textureHeight, { samples: multisample, type: HalfFloatType } );

		const material = new ShaderMaterial( {
			uniforms: UniformsUtils.clone( shader.uniforms ),
			fragmentShader: shader.fragmentShader,
			vertexShader: shader.vertexShader
		} );

		material.uniforms[ 'tDiffuse' ].value = renderTarget.texture;
		material.uniforms[ 'color' ].value = color;
		material.uniforms[ 'textureMatrix' ].value = textureMatrix;

		this.material = material;

		this.onBeforeRender = function ( renderer, scene, camera ) {

			reflectorWorldPosition.setFromMatrixPosition( scope.matrixWorld );
			cameraWorldPosition.setFromMatrixPosition( camera.matrixWorld );

			rotationMatrix.extractRotation( scope.matrixWorld );

			normal.set( 0, 0, 1 );
			normal.applyMatrix4( rotationMatrix );

			view.subVectors( reflectorWorldPosition, cameraWorldPosition );

			// Avoid rendering when reflector is facing away

			if ( view.dot( normal ) > 0 ) return;

			view.reflect( normal ).negate();
			view.add( reflectorWorldPosition );

			rotationMatrix.extractRotation( camera.matrixWorld );

			lookAtPosition.set( 0, 0, - 1 );
			lookAtPosition.applyMatrix4( rotationMatrix );
			lookAtPosition.add( cameraWorldPosition );

			target.subVectors( reflectorWorldPosition, lookAtPosition );
			target.reflect( normal ).negate();
			target.add( reflectorWorldPosition );

			virtualCamera.position.copy( view );
			virtualCamera.up.set( 0, 1, 0 );
			virtualCamera.up.applyMatrix4( rotationMatrix );
			virtualCamera.up.reflect( normal );
			virtualCamera.lookAt( target );

			virtualCamera.far = camera.far; // Used in WebGLBackground

			virtualCamera.updateMatrixWorld();
			virtualCamera.projectionMatrix.copy( camera.projectionMatrix );

			// Update the texture matrix
			textureMatrix.set(
				0.5, 0.0, 0.0, 0.5,
				0.0, 0.5, 0.0, 0.5,
				0.0, 0.0, 0.5, 0.5,
				0.0, 0.0, 0.0, 1.0
			);
			textureMatrix.multiply( virtualCamera.projectionMatrix );
			textureMatrix.multiply( virtualCamera.matrixWorldInverse );
			textureMatrix.multiply( scope.matrixWorld );

			// Now update projection matrix with new clip plane, implementing code from: http://www.terathon.com/code/oblique.html
			// Paper explaining this technique: http://www.terathon.com/lengyel/Lengyel-Oblique.pdf
			reflectorPlane.setFromNormalAndCoplanarPoint( normal, reflectorWorldPosition );
			reflectorPlane.applyMatrix4( virtualCamera.matrixWorldInverse );

			clipPlane.set( reflectorPlane.normal.x, reflectorPlane.normal.y, reflectorPlane.normal.z, reflectorPlane.constant );

			const projectionMatrix = virtualCamera.projectionMatrix;

			q.x = ( Math.sign( clipPlane.x ) + projectionMatrix.elements[ 8 ] ) / projectionMatrix.elements[ 0 ];
			q.y = ( Math.sign( clipPlane.y ) + projectionMatrix.elements[ 9 ] ) / projectionMatrix.elements[ 5 ];
			q.z = - 1.0;
			q.w = ( 1.0 + projectionMatrix.elements[ 10 ] ) / projectionMatrix.elements[ 14 ];

			// Calculate the scaled plane vector
			clipPlane.multiplyScalar( 2.0 / clipPlane.dot( q ) );

			// Replacing the third row of the projection matrix
			projectionMatrix.elements[ 2 ] = clipPlane.x;
			projectionMatrix.elements[ 6 ] = clipPlane.y;
			projectionMatrix.elements[ 10 ] = clipPlane.z + 1.0 - clipBias;
			projectionMatrix.elements[ 14 ] = clipPlane.w;

			// Render
			scope.visible = false;

			const currentRenderTarget = renderer.getRenderTarget();

			const currentXrEnabled = renderer.xr.enabled;
			const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;
			const currentOutputEncoding = renderer.outputEncoding;
			const currentToneMapping = renderer.toneMapping;

			renderer.xr.enabled = false; // Avoid camera modification
			renderer.shadowMap.autoUpdate = false; // Avoid re-computing shadows
			renderer.outputEncoding = LinearEncoding;
			renderer.toneMapping = NoToneMapping;

			renderer.setRenderTarget( renderTarget );

			renderer.state.buffers.depth.setMask( true ); // make sure the depth buffer is writable so it can be properly cleared, see #18897

			if ( renderer.autoClear === false ) renderer.clear();
			renderer.render( scene, virtualCamera );

			renderer.xr.enabled = currentXrEnabled;
			renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
			renderer.outputEncoding = currentOutputEncoding;
			renderer.toneMapping = currentToneMapping;

			renderer.setRenderTarget( currentRenderTarget );

			// Restore viewport

			const viewport = camera.viewport;

			if ( viewport !== undefined ) {

				renderer.state.viewport( viewport );

			}

			scope.visible = true;

		};

		this.getRenderTarget = function () {

			return renderTarget;

		};

		this.dispose = function () {

			renderTarget.dispose();
			scope.material.dispose();

		};

	}

}

Reflector.ReflectorShader = {

	uniforms: {

		'color': {
			value: null
		},

		'tDiffuse': {
			value: null
		},

		'textureMatrix': {
			value: null
		}

	},

	vertexShader: /* glsl */`
		uniform mat4 textureMatrix;
		varying vec4 vUv;
		#include <common>
		#include <logdepthbuf_pars_vertex>
		void main() {
			vUv = textureMatrix * vec4( position, 1.0 );
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			#include <logdepthbuf_vertex>
		}`,

	fragmentShader: /* glsl */`
		uniform vec3 color;
		uniform sampler2D tDiffuse;
		varying vec4 vUv;
		#include <logdepthbuf_pars_fragment>
		float blendOverlay( float base, float blend ) {
			return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );
		}
		vec3 blendOverlay( vec3 base, vec3 blend ) {
			return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );
		}
		void main() {
			#include <logdepthbuf_fragment>
			vec4 base = texture2DProj( tDiffuse, vUv );
			gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );
			#include <tonemapping_fragment>
			#include <encodings_fragment>
		}`
};

/* Add this component to an <a-plane> to turn it into a mirror
    */

AFRAME.registerComponent('mirror', {
  schema: {
    quality: {type: 'string', oneOf: ['high, low'], default: 'high'}
  },

  init() {

    this.el.addEventListener("loaded", () => {

      function nearestPowerOf2(n) {
        return 1 << 31 - Math.clz32(n);
      }

      // 2 * nearest power of 2 gives a nice look, but at a perf cost.
      const factor = (this.data.quality === 'high') ? 2 : 1;
      const geometry = this.el.getObject3D('mesh').geometry;

      const mirror = new Reflector( geometry, {
        textureWidth: factor * nearestPowerOf2(window.innerWidth * window.devicePixelRatio),
        textureHeight: factor * nearestPowerOf2(window.innerHeight * window.devicePixelRatio)
      } );

      // make sure base object material does not interfere with mirror.
      // this.el.getObject3D('mesh').material.side = THREE.FrontSide;
      // needs work - how to get mirror back to show?
      //this.el.getObject3D('mesh').material.opacity = 0;

      mirror.position.z = 0.01;
      this.el.object3D.add(mirror);
      //this.el.object3D.getWorldPosition(mirror.position);
      //this.el.sceneEl.object3D.add(mirror);
    });
  }

});
