class_name Foe
extends RefCounted
## Enemy data + state (ported from the 1.0 HTML build).

var type: String
var x: float
var y: float
var z: float = 0.0
var vx: float = 0.0
var vy: float = 0.0
var face: int = -1
var hp: float
var maxhp: float
var spd: float
var atk: float
var h: float
var reach: float
var wt: float
var st: String = "idle"   # idle | walk | attack | hurt | tele | charge | launched | ko | down
var t: int = 0
var inv: int = 0
var atkCd: int = 0
var atkCount: int = 0
# paced-brain AI
var mode: String = ""
var aiT: int = 0
var offY: float = 0.0
var strafeDir: int = 1


static func make(p_type: String, px: float, py: float) -> Foe:
	var stats: Dictionary = {
		"guard": {"hp": 40.0, "spd": 0.8, "atk": 6.0, "h": 88.0, "reach": 50.0, "wt": 1.0},
		"exec": {"hp": 60.0, "spd": 0.6, "atk": 10.0, "h": 84.0, "reach": 40.0, "wt": 1.3},
		"heavy": {"hp": 120.0, "spd": 0.45, "atk": 18.0, "h": 100.0, "reach": 44.0, "wt": 2.2},
		"ledger": {"hp": 220.0, "spd": 0.5, "atk": 14.0, "h": 110.0, "reach": 48.0, "wt": 1.8},
	}[p_type]
	var f := Foe.new()
	f.type = p_type
	f.x = px
	f.y = py
	f.hp = stats["hp"]
	f.maxhp = stats["hp"]
	f.spd = stats["spd"]
	f.atk = stats["atk"]
	f.h = stats["h"]
	f.reach = stats["reach"]
	f.wt = stats["wt"]
	return f
