import { 
  WebGLRenderer, ACESFilmicToneMapping, sRGBEncoding, 
  Color, CylinderGeometry, Group, Raycaster, Vector3,
  RepeatWrapping, FrontSide, BackSide, DoubleSide, BoxGeometry, Mesh, PointLight, MeshPhysicalMaterial, PerspectiveCamera,
  Scene, PMREMGenerator, PCFSoftShadowMap, MeshBasicMaterial,
  Vector2, TextureLoader, SphereGeometry, MeshStandardMaterial
} from 'https://cdn.skypack.dev/three@0.137'
import { FBXLoader } from 'https://cdn.skypack.dev/three@0.137/examples/jsm/loaders/FBXLoader'
import { OrbitControls } from 'https://cdn.skypack.dev/three-stdlib@2.8.5/controls/OrbitControls'
import { RGBELoader } from 'https://cdn.skypack.dev/three-stdlib@2.8.5/loaders/RGBELoader'
import { mergeBufferGeometries } from 'https://cdn.skypack.dev/three-stdlib@2.8.5/utils/BufferGeometryUtils'
// import SimplexNoise from 'https://cdn.skypack.dev/simplex-noise@3.0.0'

let player = null

let player_speed = 0

let player_state = 'grounded'
let is_jumping = 0
let jump_target = null
let speed = 0.09
let keymap = {}

let eth_mesh = null
let usdc_mesh = null

let coins = []

let controls
let floors = []

let wall = null
const raycaster = new Raycaster(new Vector3(), new Vector3(0, -1, 0), 0, 15)

let npcs = []
const NPC_COUNT = 3

const JUMP_HEIGHT = 2

const FLOOR_SIZE = 2.5
const MAP_WIDTH = 60
const MAP_HEIGHT = 60

const MAX_RADIUS = 15
let WALL_RADIUS = 15
let start = Date.now()
setInterval(() => {
  WALL_RADIUS = (Math.cos((Date.now() - start) / 15000) + 1) * MAX_RADIUS + 1
  WALL_PLAYER_BUFFER = WALL_RADIUS - 0.5
}, 10)
const WALL_HEIGHT = 58
let WALL_PLAYER_BUFFER = WALL_RADIUS - 0.5

// envmap https://polyhaven.com/a/herkulessaulen

const scene = new Scene()
scene.background = new Color("#FFEECC")

const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1000)
camera.position.set(-17,15,8)

const renderer = new WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.toneMapping = ACESFilmicToneMapping
renderer.outputEncoding = sRGBEncoding
renderer.physicallyCorrectLights = true
// renderer.shadowMap.enabled = true
renderer.shadowMap.type = PCFSoftShadowMap
document.body.appendChild(renderer.domElement)

const light = new PointLight( new Color("#FFCB8E").convertSRGBToLinear()/*.convertSRGBToLinear()*/, 80, 200 )
light.position.set(10, 20, 10)

light.castShadow = true 
light.shadow.mapSize.width = 512 
light.shadow.mapSize.height = 512 
light.shadow.camera.near = 0.5 
light.shadow.camera.far = 500 
scene.add( light )

controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0,0,0)
controls.dampingFactor = 0.05
controls.enableDamping = true

let pmrem = new PMREMGenerator(renderer)
pmrem.compileEquirectangularShader()

let envmap



let degen_mesh


// const fbxLoader = new FBXLoader()
// fbxLoader.load(
//     'assets/degen3.fbx',
//     (object) => {
//         // object.traverse(function (child) {
//         //     if ((child as THREE.Mesh).isMesh) {
//         //         // (child as THREE.Mesh).material = material
//         //         if ((child as THREE.Mesh).material) {
//         //             ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).transparent = false
//         //         }
//         //     }
//         // })
//         // object.scale.set(.01, .01, .01)
//         degen_mesh = object
//         degen_mesh.position.y = 5
//         // ez debug
//         window.degen_mesh = object
//         scene.add(degen_mesh)

//         // degen_mesh.children[0].scale.set(new Vector3(0.3, 0.3, 0.3))

//         onLoad()
//     },
//     (xhr) => {
//         console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
//     },
//     (error) => {
//         console.log(error)
//     }
// )

function rnd11() {
  return (Math.random() - 0.5) * 2
}

const fbxLoader = new FBXLoader()

function loadCoin(name) {
  fbxLoader.load(
    `assets/${name}.fbx`,
    onCoinLoad,
    (xhr) => {
        console.log(name + ': ' + (xhr.loaded / xhr.total) * 100 + '% loaded')
    },
    (error) => {
        console.log(error)
    }
  )
}

loadCoin('usdc')
loadCoin('eth')

function tileToPosition(tileX, tileY) {
  return new Vector2((tileX + (tileY % 2) * 0.5) * 1.77, tileY * 1.535)
}

function hexGeometry(width, height, position) {
  /* a little bigger bottom looks nicer but causes ray casting to detect incorrectly */
  let geo  = new CylinderGeometry(width, width * 1.05/*.2*/, height, 6, 1, false)
  geo.translate(position.x * width, height * 0.5, position.y * width)

  return geo
}

// let dirtGeo = new BoxGeometry(0,0,0)
// let dirt2Geo = new BoxGeometry(0,0,0)
// let stoneGeo = new BoxGeometry(0,0,0)
// let sandGeo = new BoxGeometry(0,0,0)
// let grassGeo = new BoxGeometry(0,0,0)

function hex(height, position) {
  let geo = hexGeometry(FLOOR_SIZE, height, position)

  // dirtGeo = mergeBufferGeometries([geo, dirtGeo])
  return geo
}

function hexMesh(geo, map) {
  let mat = new MeshPhysicalMaterial({ 
    envMap: envmap, 
    envMapIntensity: 0.135, 
    flatShading: true,
    map
  })

  let mesh = new Mesh(geo, mat)
  mesh.castShadow = true //default is false
  mesh.receiveShadow = true //default

  return mesh
}

function hexMeshSimple(height, position, map) {
  let geo = hexGeometry(FLOOR_SIZE, height, position)

  let mat
  if (map) {
    mat = new MeshPhysicalMaterial({ 
      envMap: envmap, 
      envMapIntensity: 0.135, 
      flatShading: true,
      map
    })
  } else {
    mat = new MeshBasicMaterial( {color: 0x003399} )
  }

  let mesh = new Mesh(geo, mat)
  mesh.castShadow = true //default is false
  mesh.receiveShadow = true //default
  mesh.position.y = -height - 1

  return mesh
}

class Player extends Group {
  constructor(primary_color, secondary_color) {
    super()
    
    const player_geometry = new BoxGeometry( 1, 2, 1 )
    const material = new MeshBasicMaterial( {color: primary_color} )
    const mesh = new Mesh(player_geometry, material)
    
    const player_geometry2 = new BoxGeometry( 0.3, 2.3, 0.3 )
    const material2 = new MeshBasicMaterial( {color: secondary_color || ~primary_color} )
    const mesh2 = new Mesh(player_geometry2, material2)
  
    // this.geometry = player_geometry
    // this.material = material

    // let group = new Group()
    // group.add(mesh)
    // group.add(mesh2)

    this.add(mesh)
    this.add(mesh2)
    this.position.y = 0
  
    // group.position.y = 5
    // return group
  }

  update() {
    console.log('player update ' + Date.now())
  }
}

function onCoinLoad(object) {
    // eth_mesh = object
    // ez debug
    // window.eth_mesh = object

    // eth_mesh.scale.multiplyScalar(0.003)
    // scene.add(eth_mesh)

    setInterval(() => spawnCoin(object), Math.random() * 3000 + 300)
}

function spawnCoin(mesh) {
  let m = mesh.clone()
  m.material = mesh.material
  m.geometry = mesh.geometry
  m.scale.multiplyScalar(0.003); 
  m.position.set(rnd11() * WALL_RADIUS + 1, 0, rnd11() * WALL_RADIUS + 1)
  scene.add(m)
  coins.push(m)
  
  setTimeout(() => {
    let index = coins.indexOf(m)
    if (index >= 0) {
      coins.splice(index, 1)
      scene.remove(m)
      // TODO: is this necessary..?
      // console.log(renderer.info.memory.geometries)
      // for (let child of m.children)
      //   child.geometry.dispose()
      // console.log(renderer.info.memory.geometries)
    }
  }, 5000)
}

function makePlayer(primary_color, secondary_color) {
  return new Player(primary_color, secondary_color)

  const player_geometry = new BoxGeometry( 1, 2, 1 )
  const material = new MeshBasicMaterial( {color: primary_color} )
  const mesh = new Mesh(player_geometry, material)
  
  const player_geometry2 = new BoxGeometry( 0.3, 2.3, 0.3 )
  const material2 = new MeshBasicMaterial( {color: secondary_color || ~primary_color} )
  const mesh2 = new Mesh(player_geometry2, material2)

  let group = new Group()
  group.add(mesh)
  group.add(mesh2)

  group.position.y = 5
  return group
}

function updatePlayer(p, dx, dy) {
  // console.log('1-' + p.position.y)

  if (dx)
    p.position.x += dx
  if (dy)
    p.position.z += dy

  if (p == player) {
    if (player_state == 'jumping_up') {
      p.position.y += speed
      if (p.position.y >= jump_target) {
        player_state = 'jumping_down'
        // clamp but no frame delta correction here :(
        p.position.y = jump_target
        jump_target = 0
      }
    } else if (player_state == 'jumping_down') {
      p.position.y -= speed
      if (p.position.y <= jump_target) {
        player_state = 'grounded'
        // clamp but no frame delta correction here :(
        p.position.y = jump_target
        jump_target = null
        // degen_mesh.children[0].morphTargetInfluences[0] = 0
        // TODO: remove
        // degen_mesh.children[0].morphTargetInfluences[1] = 0
      }
    }
  }

  // console.log('2-' + p.position.y)

  let dist_center = Math.sqrt(Math.pow(p.position.x, 2) + Math.pow(p.position.z, 2))
  // console.log(dist_center)
  if (dist_center > WALL_PLAYER_BUFFER) {
    // y = mx + n
    // x = y/m - n
    // m = y/x - n/x
    //let m = player.position.y / player.position.x
    let a = Math.atan2(p.position.z, p.position.x)
    let x = Math.cos(a) * WALL_PLAYER_BUFFER
    let z = Math.sin(a) * WALL_PLAYER_BUFFER

    p.position.x = x
    p.position.z = z
  }


  if (p != player || player_state == 'grounded') {
    raycaster.ray.origin = new Vector3(p.position.x, p.position.y + 5.1, p.position.z)
    const intersects = raycaster.intersectObjects( floors )
    if (intersects.length) {
      // if (p != player)
        //  debugger //console.log(intersects)
      let obj = intersects[0].object
      obj.material.color = new Color(1, 0, 0)
      obj.position.y -= 0.01
      setTimeout(() => {
        obj.material.color = new Color(1, 1, 1)
        obj.position.y -= 2

        setTimeout(() => {
          // obj.material.color = new Color(1, 1, 1)
          obj.position.y = -5
        }, 15000)
      }, 2000)
      // debugger

      if (p == player)
        is_falling = false
    } else {
      // fall or death logic
      if (p == player) {
        is_falling = true
        setTimeout(() => {
          if (is_falling) {
            // degen_mesh.children[0].morphTargetInfluences[0] = 0
            // degen_mesh.children[0].morphTargetInfluences[1] = 1
            player.children[0].material.color = new Color(0.3, 0.3, 0.3)
            jump_target = -10
            player_state = 'jumping_down'
          }
        }, 200)
      } else {
        p.children[0].material.color = new Color(0.3, 0.3, 0.3)
      }
    }
  }

}

let is_falling = false

async function onLoad() {
  let envmapTexture = await new RGBELoader().loadAsync("assets/envmap.hdr")
  let rt = pmrem.fromEquirectangular(envmapTexture)
  envmap = rt.texture

  let textures = {
    dirt: await new TextureLoader().loadAsync("assets/dirt.png"),
    dirt2: await new TextureLoader().loadAsync("assets/dirt2.jpg"),
    // grass: await new TextureLoader().loadAsync("assets/grass.jpg"),
    // sand: await new TextureLoader().loadAsync("assets/sand.jpg"),
    // water: await new TextureLoader().loadAsync("assets/water.jpg"),
    // stone: await new TextureLoader().loadAsync("assets/stone.png"),
  }

  // const simplex = new SimplexNoise() // optional seed as a string parameter

  for (let i = -MAP_WIDTH; i <= MAP_WIDTH; i++) {
    for (let j = -MAP_HEIGHT; j <= MAP_HEIGHT; j++) {
      let position = tileToPosition(i, j)

      if (position.length() > Math.sqrt((MAP_WIDTH * MAP_HEIGHT) / 2))
        continue
      
      // let noise = (simplex.noise2D(i * 0.1, j * 0.1) + 1) * 0.5
      // noise = Math.pow(noise, 1.5)
      // let height = noise * MAX_HEIGHT
      let height = 4

      let mesh = hexMeshSimple(height, position, textures.dirt)
      floors.push(mesh)
      scene.add(mesh)
    } 
  }

  // let stoneMesh = hexMesh(stoneGeo, textures.stone)
  // let grassMesh = hexMesh(grassGeo, textures.grass)
  // let dirt2Mesh = hexMesh(dirt2Geo, textures.dirt2)
  // let sandMesh  = hexMesh(sandGeo, textures.sand)
  // scene.add(stoneMesh, dirtMesh, dirt2Mesh, sandMesh, grassMesh)

  // floors = [dirtMesh]
  // scene.add(dirtMesh)


  // player = degen_mesh
  player = makePlayer(0x116622)
  scene.add(player)
  // cache for ez debugging
  window.player = player

  for (let i = 0; i < NPC_COUNT; i++) {
    let npc = makePlayer(0x004400 * i, (0xee0000 / i) | 0)
    npcs.push({mesh: npc, speed: new Vector3(speed * 2 * (Math.random()-0.5), 0, speed * 2 * (Math.random()-0.5))})
    npc.position.x = WALL_RADIUS * (Math.random()-0.5)
    npc.position.z = WALL_RADIUS * (Math.random()-0.5)
    scene.add(npc)
  }

  window.addEventListener('keydown', (e) => {
    keymap[e.key] = true
    // console.log(e)
  })

  window.addEventListener('keyup', (e) => {
    keymap[e.key] = false
  })



  wall = new Mesh(
    new CylinderGeometry(1, 1, WALL_HEIGHT, 50, 1, true),
    new MeshPhysicalMaterial({
      envMap: envmap,
      map: textures.dirt,
      envMapIntensity: 0.2, 
      side: BackSide,
    })
  )
  // wall.receiveShadow = true
  wall.position.set(0, 2, 0)
  scene.add(wall)

  renderer.setAnimationLoop(onUpdate)
}




function updateCoins() {
  for (let coin of coins) {
    // debugger
    coin.position.y = -0.5 + 0.5 * (1 + Math.sin(Date.now() / 800))
    coin.rotation.y = 3.14 * (1 + (Date.now() / 2000))
  }
}




let lastUpdate = Date.now()
function onUpdate() {
  let now = Date.now()
  let deltaTime = now - lastUpdate
  lastUpdate = now

  document.title = deltaTime.toString()

  let tmp_speed = speed * (player_state == 'jumping_down' ? 0.9 : 1)
  player_speed = Math.min(speed, player_speed + tmp_speed * 0.04)
  player_speed *= deltaTime / 8

  let is_moving = false
  let old_pos = new Vector3(player.position.x, player.position.y, player.position.z)
  if (keymap['w']) {
    player.position.z -= player_speed
    is_moving = true
  }
  if (keymap['s']) {
    player.position.z += player_speed
    is_moving = true
  }
  if (keymap['a']) {
    player.position.x -= player_speed
    is_moving = true
  }
  if (keymap['d']) {
    player.position.x += player_speed
    is_moving = true
  }
  if (keymap[' ']) {
    if (player_state == 'grounded') {
      is_falling = false
      player_state = 'jumping_up'
      // degen_mesh.children[0].morphTargetInfluences[0] = 1
      jump_target = JUMP_HEIGHT
    }
    is_moving = true
  }

  if (!is_moving)
    player_speed = Math.max(0, player_speed - 0.1)
  // console.log(player_state)

  // let delta_pos = new Vector3(player.position.x - old_pos.x, player.position.y - old_pos.y, player.position.z - old_pos.z)
  // let a = Math.atan2(delta_pos.z, delta_pos.x)
  // console.log(a)
  // player.rotation.y = new Vector3().angleTo(player.position)

  // update wall
  wall.scale.x = WALL_RADIUS
  wall.scale.z = WALL_RADIUS

  updatePlayer(player, 0, 0)
  for (let i in npcs) {
    let p = npcs[i].mesh
    let s = npcs[i].speed
    if (Date.now() % 400 <= 2) {
      s.x = speed * 2 * (Math.random() - 0.5)
      s.z = speed * 2 * (Math.random() - 0.5)
    }
    updatePlayer(p, s.x, s.z)
  }

  camera.position.set(player.position.x, camera.position.y, player.position.z + 7)
  // camera.position.z = player.position.z + 7
  controls.target.set(player.position.x, player.position.y + 1, player.position.z)
  // player.rotation.y = camera.rotation.y
  // controls.target.copy(player.position)

  controls.update()

  updateCoins()

  renderer.render(scene, camera)
}

onLoad()