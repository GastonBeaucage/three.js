/**
 * @author mrdoob / http://mrdoob.com/
 */

var APP = {

	Player: function () {

		var scope = this;

		var loader = new THREE.ObjectLoader();
		var camera, scene, renderer;

		var vr, controls, effect;

		var events = {};

		this.dom = undefined;

		this.width = 500;
		this.height = 500;
		
		var sphereShape, sphereBody, world, physicsMaterial, walls=[], balls=[], ballMeshes=[], boxes=[], boxMeshes=[], particles=[], sprites=[];
		
		initCannon();
		
		function initCannon(){
			// Setup our world
			world = new CANNON.World();
			world.quatNormalizeSkip = 0;
			world.quatNormalizeFast = false;

			var solver = new CANNON.GSSolver();

			world.defaultContactMaterial.contactEquationStiffness = 1e9;
			world.defaultContactMaterial.contactEquationRelaxation = 4;

			solver.iterations = 7;
			solver.tolerance = 0.1;
			var split = true;
			if(split)
			world.solver = new CANNON.SplitSolver(solver);
			else
			world.solver = solver;

			world.gravity.set(0,-20,0);
			world.broadphase = new CANNON.NaiveBroadphase();

			// Create a slippery material (friction coefficient = 0.0)
			physicsMaterial = new CANNON.Material("slipperyMaterial");
			var physicsContactMaterial = new CANNON.ContactMaterial(physicsMaterial,
															physicsMaterial,
															0.0, // friction coefficient
															0.3  // restitution
															);
			// We must add the contact materials to the world
			world.addContactMaterial(physicsContactMaterial);
		}
		
		this.load = function ( json ) {

			vr = json.project.vr;

			renderer = new THREE.WebGLRenderer( { antialias: true } );
			renderer.setClearColor( 0x000000 );
			renderer.setPixelRatio( window.devicePixelRatio );

			if ( json.project.shadows ) {

				renderer.shadowMap.enabled = true;
				// renderer.shadowMap.type = THREE.PCFSoftShadowMap;

			}

			this.dom = renderer.domElement;

			this.setScene( loader.parse( json.scene ) );
			this.setCamera( loader.parse( json.camera ) );

			events = {
				init: [],
				start: [],
				stop: [],
				keydown: [],
				keyup: [],
				mousedown: [],
				mouseup: [],
				mousemove: [],
				touchstart: [],
				touchend: [],
				touchmove: [],
				update: []
			};

			var scriptWrapParams = 'player,renderer,scene,camera';
			var scriptWrapResultObj = {};

			for ( var eventKey in events ) {

				scriptWrapParams += ',' + eventKey;
				scriptWrapResultObj[ eventKey ] = eventKey;

			}

			var scriptWrapResult = JSON.stringify( scriptWrapResultObj ).replace( /\"/g, '' );

			for ( var uuid in json.scripts ) {

				var object = scene.getObjectByProperty( 'uuid', uuid, true );

				if ( object === undefined ) {

					console.warn( 'APP.Player: Script without object.', uuid );
					continue;

				}

				var scripts = json.scripts[ uuid ];

				for ( var i = 0; i < scripts.length; i ++ ) {

					var script = scripts[ i ];

					var functions = ( new Function( scriptWrapParams, script.source + '\nreturn ' + scriptWrapResult + ';' ).bind( object ) )( this, renderer, scene, camera );

					for ( var name in functions ) {

						if ( functions[ name ] === undefined ) continue;

						if ( events[ name ] === undefined ) {

							console.warn( 'APP.Player: Event type not supported (', name, ')' );
							continue;

						}

						events[ name ].push( functions[ name ].bind( object ) );

					}

				}

			}

			dispatch( events.init, arguments );

		};

		this.setCamera = function ( value ) {

			camera = value;
			camera.aspect = this.width / this.height;
			camera.updateProjectionMatrix();

			if ( vr === true ) {

				if ( camera.parent === null ) {

					// camera needs to be in the scene so camera2 matrix updates

					scene.add( camera );

				}

				var camera2 = camera.clone();
				camera.add( camera2 );

				camera = camera2;

				controls = new THREE.VRControls( camera );
				effect = new THREE.VREffect( renderer );

				document.addEventListener( 'keyup', function ( event ) {

					switch ( event.keyCode ) {
						case 90:
							controls.zeroSensor();
							break;
					}

				} );

				this.dom.addEventListener( 'dblclick', function () {

					effect.setFullScreen( true );

				} );

			}

		};

		this.setScene = function ( value ) {

			scene = value;

		};

		this.setSize = function ( width, height ) {

			if ( renderer._fullScreen ) return;

			this.width = width;
			this.height = height;

			camera.aspect = this.width / this.height;
			camera.updateProjectionMatrix();

			renderer.setSize( width, height );

		};

		function dispatch( array, event ) {

			for ( var i = 0, l = array.length; i < l; i ++ ) {

				array[ i ]( event );

			}

		}

		var prevTime, request;

		var dt = 1/60;
		function animate( time ) {

			request = requestAnimationFrame( animate );

			try {

				dispatch( events.update, { time: time, delta: time - prevTime } );

			} catch ( e ) {

				console.error( ( e.message || e ), ( e.stack || "" ) );

			}

			if ( vr === true ) {

				controls.update();
				effect.render( scene, camera );

			} else {
				world.step(dt);

				// Update ball positions
				for(var i=0; i<balls.length; i++){
					ballMeshes[i].position.copy(balls[i].position);
					ballMeshes[i].quaternion.copy(balls[i].quaternion);
				}

				// Update box positions
				for(var i=0; i<boxes.length; i++){
					boxMeshes[i].position.copy(boxes[i].position);
					boxMeshes[i].quaternion.copy(boxes[i].quaternion);
				}
				
				// Update box positions
				for(var i=0; i<particles.length; i++){
					sprites[i].position.copy(particles[i].position);
					sprites[i].quaternion.copy(particles[i].quaternion);
				}
				
				renderer.render( scene, camera );

			}

			prevTime = time;

		}

		this.play = function () {

			document.addEventListener( 'keydown', onDocumentKeyDown );
			document.addEventListener( 'keyup', onDocumentKeyUp );
			document.addEventListener( 'mousedown', onDocumentMouseDown );
			document.addEventListener( 'mouseup', onDocumentMouseUp );
			document.addEventListener( 'mousemove', onDocumentMouseMove );
			document.addEventListener( 'touchstart', onDocumentTouchStart );
			document.addEventListener( 'touchend', onDocumentTouchEnd );
			document.addEventListener( 'touchmove', onDocumentTouchMove );

			dispatch( events.start, arguments );

			/*var navmeshGeometry = new THREE.Geometry().fromBufferGeometry(scene.getObjectByName("Navmesh").geometry)
					
			level = new THREE.Mesh(navmeshGeometry);
			
			var zoneNodes = patrol.buildNodes(navmeshGeometry);	

			patrol.setZoneData('level', zoneNodes);
			
			var mesh = new THREE.Mesh(navmeshGeometry, new THREE.MeshBasicMaterial({
				color: 0xd79fd4,
				opacity: 1.0,
				transparent: false
			}));*/
			
			playerNavMeshGroup = patrol.getGroup('level', player.position);
			
			scene.traverse(function(object) {
				if(object.parent !== scene) {
					return;
				}
				if(object instanceof THREE.Mesh) {
					if(object.geometry instanceof THREE.BoxGeometry) {
						var halfExtents = new CANNON.Vec3(object.scale.x / 2 ,object.scale.y / 2, object.scale.z / 2);
						var boxShape = new CANNON.Box(halfExtents);
						var boxBody = new CANNON.Body({ mass: object.userData.mass,
														collisionFilterGroup: object.userData.filterGroup,
														collisionFilterMask: object.userData.filterMask});
						boxBody.addShape(boxShape);
						world.addBody(boxBody);
						boxBody.position.copy(object.position);
						boxBody.quaternion.copy(object.quaternion);
						boxes.push(boxBody);
						boxMeshes.push(object);
						return;
					}
					if(object.geometry instanceof THREE.SphereGeometry) {
						sphereShape = new CANNON.Sphere(object.scale.x);
						sphereBody = new CANNON.Body({ mass: object.userData.mass,
														collisionFilterGroup: object.userData.filterGroup,
														collisionFilterMask: object.userData.filterMask});
						sphereBody.addShape(sphereShape);
						sphereBody.position.copy(object.position);
						sphereBody.quaternion.copy(object.quaternion);
						sphereBody.linearDamping = 0.5;
						world.addBody(sphereBody);
						balls.push(sphereBody);
						ballMeshes.push(object);
						return;
					}
				}
				if(object instanceof THREE.Sprite) {
					var spriteShape = new CANNON.Particle();
					var spriteBody = new CANNON.Body({ mass: object.userData.mass,
														collisionFilterGroup: object.userData.filterGroup,
														collisionFilterMask: object.userData.filterMask});
					spriteBody.addShape(spriteShape);
					world.addBody(spriteBody);
					spriteBody.position.copy(object.position);
					particles.push(spriteBody);
					sprites.push(object);
					return;
				}
				if(object instanceof THREE.Group) {
					var boxBody = new CANNON.Body({ mass: 1, fixedRotation: false});
					var sphereBody = new CANNON.Body({ mass: 1, fixedRotation: false});
					var group = object;
					var sphere;
					object.traverse(function(object) {
						if(object.geometry instanceof THREE.BoxGeometry) {
							var halfExtents = new CANNON.Vec3(object.scale.x / 2 ,object.scale.y / 2, object.scale.z / 2);
							var boxShape = new CANNON.Box(halfExtents);
							boxBody.addShape(boxShape, object.position, object.quaternion);
							return;
						}
						
						if(object.geometry instanceof THREE.SphereGeometry) {
							sphere = object;
							sphereShape = new CANNON.Sphere(object.scale.x);
							sphereBody.addShape(sphereShape, object.position, object.quaternion);
							sphereBody.position.copy(group.position);
							sphereBody.quaternion.copy(group.quaternion);
							world.addBody(sphereBody);
							balls.push(sphereBody);
							ballMeshes.push(object);
						}
					});
					boxBody.position.copy(group.position);
					boxBody.quaternion.copy(group.quaternion);
					world.addBody(boxBody);
					boxes.push(boxBody);
					boxMeshes.push(group);
					world.addConstraint(new CANNON.DistanceConstraint(sphereBody, boxBody, 10));	
				}
			});
			
			request = requestAnimationFrame( animate );
			prevTime = performance.now();

		};

		this.stop = function () {

			document.removeEventListener( 'keydown', onDocumentKeyDown );
			document.removeEventListener( 'keyup', onDocumentKeyUp );
			document.removeEventListener( 'mousedown', onDocumentMouseDown );
			document.removeEventListener( 'mouseup', onDocumentMouseUp );
			document.removeEventListener( 'mousemove', onDocumentMouseMove );
			document.removeEventListener( 'touchstart', onDocumentTouchStart );
			document.removeEventListener( 'touchend', onDocumentTouchEnd );
			document.removeEventListener( 'touchmove', onDocumentTouchMove );

			dispatch( events.stop, arguments );
			
			initCannon();

			cancelAnimationFrame( request );

		};

		//

		function onDocumentKeyDown( event ) {

			dispatch( events.keydown, event );

		}

		function onDocumentKeyUp( event ) {

			dispatch( events.keyup, event );

		}

		function onDocumentMouseDown( event ) {

			dispatch( events.mousedown, event );

		}

		function onDocumentMouseUp( event ) {

			dispatch( events.mouseup, event );

		}

		function onDocumentMouseMove( event ) {

			dispatch( events.mousemove, event );

		}

		function onDocumentTouchStart( event ) {

			dispatch( events.touchstart, event );

		}

		function onDocumentTouchEnd( event ) {

			dispatch( events.touchend, event );

		}

		function onDocumentTouchMove( event ) {

			dispatch( events.touchmove, event );

		}

	}

};
