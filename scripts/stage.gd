extends Node2D
## Stage 1: Grease & Gold HQ. Walkable bounds and wave triggers.

const ENEMY_DEFS: Array = [
	{"frames": "res://resources/guard_frames.tres", "hp": 30, "dmg": 6, "speed": 75.0},
	{"frames": "res://resources/exec_frames.tres", "hp": 45, "dmg": 8, "speed": 65.0},
	{"frames": "res://resources/heavy_frames.tres", "hp": 80, "dmg": 12, "speed": 50.0},
]

const MIN_X := 20.0
const MAX_X := 1960.0
const MIN_Y := 180.0
const MAX_Y := 250.0

var player: CharacterBody2D
var game: Node
var wave_index := 0
var wave_trigger_x: Array = [500.0, 1100.0, 1600.0]

func _ready() -> void:
	game = get_parent()

func set_player(p: CharacterBody2D) -> void:
	player = p

func _process(_delta: float) -> void:
	if player == null or not is_instance_valid(player):
		return
	player.global_position.x = clampf(player.global_position.x, MIN_X, MAX_X)
	player.global_position.y = clampf(player.global_position.y, MIN_Y, MAX_Y)
	if wave_index < wave_trigger_x.size() and player.global_position.x > wave_trigger_x[wave_index]:
		_spawn_wave(wave_index)
		wave_index += 1

func _spawn_wave(idx: int) -> void:
	var count := 2 + idx
	for i in count:
		var def: Dictionary = ENEMY_DEFS[idx % ENEMY_DEFS.size()]
		var pos := Vector2(
			player.global_position.x + 280.0 + float(i) * 60.0,
			randf_range(MIN_Y, MAX_Y)
		)
		game.spawn_enemy(def["frames"], pos, def["hp"], def["dmg"], def["speed"])
