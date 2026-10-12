class_name Fighter
extends RefCounted
## Playable fighter data + state (ported from the 1.0 HTML build).

var key: String
var char_name: String
var x: float
var y: float
var z: float = 0.0
var vz: float = 0.0
var vx: float = 0.0
var vy: float = 0.0
var face: int = 1
var hp: float
var maxhp: float
var hype: float = 0.0
var spd: float
var atk: float
var spec: String
var st: String = "idle"   # idle | walk | attack | hurt
var t: int = 0
var atkT: int = 0
var atkN: int = 0
var atkBuf: bool = false
var specAtk: bool = false
var inv: int = 0


static func make(p_key: String, p_name: String, p_hp: float, p_spd: float, p_atk: float, p_spec: String) -> Fighter:
	var f := Fighter.new()
	f.key = p_key
	f.char_name = p_name
	f.x = 100.0
	f.y = 215.0
	f.hp = p_hp
	f.maxhp = p_hp
	f.spd = p_spd
	f.atk = p_atk
	f.spec = p_spec
	return f
