extends Node2D
## Game orchestrator: spawns player, spawns enemies, camera follow.

const PLAYER_SCENE: PackedScene = preload("res://scenes/actors/player.tscn")
const ENEMY_SCENE: PackedScene = preload("res://scenes/actors/enemy.tscn")

var player: CharacterBody2D
var score := 0
var lives := 3

@onready var stage: Node2D = $Stage
@onready var camera: Camera2D = $Stage/Camera2D
@onready var hud: Control = $CanvasLayer/HUD

func _ready() -> void:
	player = PLAYER_SCENE.instantiate()
	player.position = Vector2(120, 220)
	stage.add_child(player)
	stage.set_player(player)
	hud.set_player(player)
	hud.set_stage(stage)
	player.health_changed.connect(hud.on_health_changed)
	player.hype_changed.connect(hud.on_hype_changed)

func _process(_delta: float) -> void:
	if player == null or not is_instance_valid(player):
		return
	camera.global_position.x = clampf(player.global_position.x, 240.0, 1760.0)

func spawn_enemy(frames_path: String, pos: Vector2, hp: int, dmg: int, speed: float) -> void:
	var enemy: CharacterBody2D = ENEMY_SCENE.instantiate()
	enemy.position = pos
	stage.add_child(enemy)
	var frames := load(frames_path) as SpriteFrames
	if frames:
		enemy.setup(frames, hp, dmg, speed)
	enemy.set_target(player)
	enemy.died.connect(_on_enemy_died)

func _on_enemy_died(_enemy: CharacterBody2D) -> void:
	score += 100
	hud.set_score(score)
