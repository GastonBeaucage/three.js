/**
 * @author mrdoob / http://mrdoob.com/
 */

var globalCamera; 

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
		
		////////added
		var lastFrameTime = 0;
		var maxFrameTime = 0.03;
		var elapsedTime = 0;
		
		//var lastAngle = 0;

		var dt = 1/60;
		function animate( time ) {
			var currTime = window.performance.now();
			var delta = (currTime - lastFrameTime) / 1000;
			var dTime = Math.min(delta, maxFrameTime);
			elapsedTime += delta;
			lastFrameTime = currTime;
			
			tick(dTime);

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
				
				
				for(var i = 0; i < npcs.length; i++) {
					npcs[i].sprite.position.copy(npcs[i].sphereBody.position);
					npcs[i].sprite.translateY(1.5);
					if(npcs[i].calculatedPath && npcs[i].calculatedPath[0]) {
						var npcPosition = new THREE.Vector3().copy(npcs[i].sphereBody.position);
						var direction = npcPosition.sub(npcs[i].calculatedPath[0]);
						//console.log(direction.length());
						var angle = Math.atan(direction.x / direction.z);
						npcs[i].boxBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
						npcs[i].lastAngle = angle;
					} else {
						npcs[i].boxBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), npcs[i].lastAngle);
					}
					/*var velocity = new THREE.Vector3().copy(npcs[i].sphereBody.velocity);
					//console.log(velocity.length());
					//console.log(velocity);
					if(velocity.length() > 3){
						var angle = Math.atan(npcs[i].sphereBody.velocity.x / npcs[i].sphereBody.velocity.z);
						npcs[i].boxBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
						lastAngle = angle;
					} else {
						npcs[i].boxBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), lastAngle);
					}*/
					//var angle = Math.tan(npcs[i].sphereBody.velocity.x / npcs[i].sphereBody.velocity.z);
					//npcs[i].boxBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
				}
				
				globalCamera = camera;
				
				renderer.render( scene, camera );

			}

			prevTime = time;

		}

		var raycaster, intersectedObject;

		var mouse = new THREE.Vector2();
		
		var level;
		
		var npcs = [];
		
		var pathLines
		
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
			
			/////debug
			var geometry = new THREE.SphereGeometry( 0.25, 32, 32 );
			var material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
			player = new THREE.Mesh( geometry, material );
			scene.add( player );
				
			geometry = new THREE.BoxGeometry( 0.3, 0.3, 0.3 );
			var material = new THREE.MeshBasicMaterial( {color: 0xff0000} );
			target = new THREE.Mesh( geometry, material );
			scene.add( target );

			target.position.copy(player.position);
			
			//////

			var navmeshGeometry = new THREE.Geometry().fromBufferGeometry(scene.getObjectByName("Navmesh").geometry)
					
			level = new THREE.Mesh(navmeshGeometry);
			
			var zoneNodes = patrol.buildNodes(navmeshGeometry);	

			patrol.setZoneData('level', zoneNodes);
			
			var mesh = new THREE.Mesh(navmeshGeometry, new THREE.MeshBasicMaterial({
				color: 0xd79fd4,
				opacity: 1.0,
				transparent: false
			}));
			
			raycaster = new THREE.Raycaster();
			
			playerNavMeshGroup = patrol.getGroup('level', player.position);
			
			document.addEventListener( 'click', onDocumentMouseClick, false );
			
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
						var sphereShape = new CANNON.Sphere(object.scale.x);
						var sphereBody = new CANNON.Body({ mass: object.userData.mass,
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
				
				var npc = {type: null,
						   health: 100,
						   hitbox: {head: null,
									torso: null,
									rightArm: null,
									leftArm: null,
									legs: null},
						   weapon: null,
						   dialog: null,
						   alive: true};
				var player;
				
				if(object instanceof THREE.Group) {
					var boxBody = new CANNON.Body({ mass: 1, fixedRotation: true, collisionFilterGroup: 16, collisionFilterMask: 32});
					boxBody.npc = JSON.parse(JSON.stringify(npc));
					var group = object;				
					object.traverse(function(object) {
						if(object.geometry instanceof THREE.BoxGeometry) {
							var halfExtents = new CANNON.Vec3(object.scale.x / 2 ,object.scale.y / 2, object.scale.z / 2);
							var boxShape = new CANNON.Box(halfExtents);
							boxBody.addShape(boxShape, object.position, object.quaternion);
							if(object.name.localeCompare("Head") == 0) {
								boxBody.npc.hitbox.head = boxShape.id;
							} else if(object.name.localeCompare("Torso") == 0) {
								boxBody.npc.hitbox.torso = boxShape.id;
							} else if(object.name.localeCompare("Right Arm") == 0) {
								boxBody.npc.hitbox.rightArm = boxShape.id;
							} else if(object.name.localeCompare("Left Arm") == 0) {
								boxBody.npc.hitbox.leftArm = boxShape.id;
							} else if(object.name.localeCompare("Legs") == 0) {
								boxBody.npc.hitbox.legs = boxShape.id;
							}
							return;
						}
					});
					boxBody.position.copy(group.position);
					boxBody.quaternion.copy(group.quaternion);
					
					boxBody.collisionResponse = 0;
					
					boxBody.addEventListener("collide", function(event) {
						if(event.contact.sj.id == event.target.npc.hitbox.head) {
							console.log("Head");
						} else if(event.contact.sj.id == event.target.npc.hitbox.torso) {
							console.log("Torso");
						} else if(event.contact.sj.id == event.target.npc.hitbox.rightArm) {
							console.log("Right Arm");
						} else if(event.contact.sj.id == event.target.npc.hitbox.leftArm) {
							console.log("Left Arm");
						} else if(event.contact.sj.id == event.target.npc.hitbox.legs) {
							console.log("Legs");
						}
					});
					
					world.addBody(boxBody);
					boxes.push(boxBody);
					boxMeshes.push(group);
					
					var radius = 0.5;
					var widthSegments = 32;
					var heightSegments = 16;
					var phiStart = 0;
					var phiLength = Math.PI * 2;
					var thetaStart = 0;
					var thetaLength = Math.PI;

					var geometry = new THREE.SphereGeometry( radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength );
					var mesh = new THREE.Mesh( geometry, new THREE.MeshStandardMaterial() );
					
					mesh.position.copy(group.position.clone().add(new THREE.Vector3( 0, 0, 0 )));
					
					mesh.visible = false;
					
					scene.add(mesh);
					
					var sphereBody = new CANNON.Body({ mass: 1, fixedRotation: false});
					var sphereShape = new CANNON.Sphere(mesh.scale.x / 2);
					
					sphereBody.addShape(sphereShape, new CANNON.Vec3( 0, 0, 0));
					//sphereBody.addShape(sphereShape);
					sphereBody.position.copy(mesh.position);
					sphereBody.quaternion.copy(mesh.quaternion);
					sphereBody.linearDamping = 0.0;
					//sphereBody.collisionResponse = 0;
					world.addBody(sphereBody);
					balls.push(sphereBody);
					ballMeshes.push(mesh);
					
					world.addConstraint(new CANNON.DistanceConstraint(sphereBody, boxBody, 0));
					
					var sprite = group.getObjectByName("Sprite")
					THREE.SceneUtils.detach(sprite, group, scene);
					sprite.scale.set(2,2,2)
					
					npcs.push({sphereBody: sphereBody, boxBody: boxBody, mesh: group, sprite: sprite, lastAngle: 0});
					
					return;
				}
			});
			
			request = requestAnimationFrame( animate );
			prevTime = performance.now();

		};
		
		function onDocumentMouseClick (event) {

			event.preventDefault();
		
			//mouse.x = 0;
			//mouse.y = 0;

			//console.log(mouse);
			//console.log(camera);
			
			var viewport = window.getComputedStyle(document.getElementById("viewport"), null);
			
			//console.log(event.clientX / parseInt(viewport.getPropertyValue("width")));
			//console.log(event.clientX / window.innerWidth);
			
			//sort of works...
			mouse.x = ( event.clientX / parseInt(viewport.getPropertyValue("width")) ) * 2 - 1;
			mouse.y = - ( event.clientY / parseInt(viewport.getPropertyValue("height")) ) * 2 + 1;
			
			raycaster.setFromCamera( mouse, camera );
			
			//console.log(level);

			var intersects = raycaster.intersectObject( level );
			
			//console.log(intersects);

			if ( intersects.length > 0 ) {
				var vec = intersects[0].point;
				target.position.copy(vec);
				
				//console.log(npcs.length);

				for(var i = 0; i < npcs.length; i++) {
					
					var calculatedPath = patrol.findPath(npcs[i].sphereBody.position, target.position, 'level', playerNavMeshGroup);
					npcs[i].calculatedPath = calculatedPath;
					
					if (calculatedPath && calculatedPath.length) {

						if (pathLines) {
							scene.remove(pathLines);
						}

						var material = new THREE.LineBasicMaterial({
							color: 0x0000ff,
							linewidth: 2
						});

						var geometry = new THREE.Geometry();
						geometry.vertices.push(player.position);

						// Draw debug lines
						for (var j = 0; j < calculatedPath.length; j++) {
							geometry.vertices.push(calculatedPath[j].clone().add(new THREE.Vector3(0, 0, 0)));
						}

						pathLines = new THREE.Line( geometry, material );
						scene.add( pathLines );

						// Draw debug cubes except the last one. Also, add the player position.
						var debugPath = [player.position].concat(calculatedPath);

						for (var j = 0; j < debugPath.length - 1; j++) {
							geometry = new THREE.BoxGeometry( 0.3, 0.3, 0.3 );
							var material = new THREE.MeshBasicMaterial( {color: 0x00ffff} );
							var node = new THREE.Mesh( geometry, material );
							node.position.copy(debugPath[j]);
							pathLines.add( node );
						}
						
					}
				}
			}
		}
		
		//////added
		var down = new THREE.Vector3(0, -1, 0);
		
		function tick(dTime) {
			if (!level) {
				return;
			}

			var speed = 5;

			var targetPosition;
			var calculatedPath;

			for(var i = 0; i < npcs.length; i++) {
				calculatedPath = npcs[i].calculatedPath;
				
				if (calculatedPath && calculatedPath.length) {
					targetPosition = calculatedPath[0];
					
					raycaster.set(npcs[i].sphereBody.position, down);
					
					var testIntersects = raycaster.intersectObject( level );
					
					if ( testIntersects.length > 0 ) {
						var vec = testIntersects[0].point;
						player.position.copy(vec)
						//scene.add(target);
					}

					var vel = targetPosition.clone().sub(player.position);

					if (vel.lengthSq() > 2) {
						vel.normalize();

						// Move player to target
						player.position.add(vel.multiplyScalar(dTime * speed));
						npcs[i].sphereBody.velocity.x = vel.x * 75;
						npcs[i].sphereBody.velocity.z = vel.z * 75;
						//console.log("moving");
					} else {
						// Remove node from the path we calculated
						calculatedPath.shift();
					}
				} else {
					if(!calculatedPath || calculatedPath.length) {
						//console.log("start");
					} else {
						//console.log("end");
					}
					npcs[i].sphereBody.velocity.x = 0;
					npcs[i].sphereBody.velocity.z = 0;
				}
			}
			
		}

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
