extends CharacterBody2D

@export var display_name := "Corporate Executive"
@export var max_health := 80
@export var walk_speed := 92.0
@export var body_mass := 1.0
@export var preferred_range := 52.0
@export var attack_range := 42.0

var health := max_health
var player: CharacterBody2D
var facing := -1
var state := "idle"
var attack_cooldown := 0.0
var windup_timer := 0.0
var knockback := Vector2.ZERO
var death_timer := 0.0

@onready var direction_marker: Polygon2D = $DirectionMarker
@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D

func set_target(target: CharacterBody2D) -> void:
	player = target

func set_frames(frames: SpriteFrames) -> void:
	sprite.sprite_frames = frames

func _physics_process(delta: float) -> void:
	attack_cooldown = maxf(attack_cooldown - delta, 0.0)

	if health <= 0:
		death_timer -= delta
		velocity = Vector2.ZERO
		move_and_slide()
		_play_anim("down")
		if death_timer <= 0.0:
			queue_free()
		return

	if player == null:
		velocity = Vector2.ZERO
		return

	if knockback.length() > 1.0:
		velocity = knockback
		knockback = knockback.move_toward(Vector2.ZERO, 780.0 * delta / body_mass)
		move_and_slide()
		_play_anim("hurt")
		return

	var offset := player.global_position - global_position
	var horizontal_distance := absf(offset.x)
	var depth_distance := absf(offset.y)

	if offset.x != 0.0:
		facing = 1 if offset.x > 0.0 else -1
		direction_marker.scale.x = -facing
		sprite.flip_h = facing < 0

	if horizontal_distance <= attack_range and depth_distance < 20.0 and attack_cooldown <= 0.0:
		state = "windup"
		windup_timer = 0.30
		attack_cooldown = 1.15
		velocity = Vector2.ZERO
	elif horizontal_distance > preferred_range or depth_distance > 16.0:
		var desired := offset.normalized()
		velocity = Vector2(desired.x * walk_speed, desired.y * walk_speed * 0.72)
		state = "walk"
	else:
		velocity = Vector2.ZERO
		state = "idle"

	if state == "windup":
		windup_timer -= delta
		if windup_timer <= 0.0:
			state = "attack"

	move_and_slide()
	_play_anim(state)

func _play_anim(state_name: String) -> void:
	var anim := "idle"
	match state_name:
		"idle", "windup":
			anim = "idle"
		"walk":
			anim = "walk"
		"attack":
			anim = "attack"
		"hurt":
			anim = "hurt"
		"down":
			anim = "down"
	if sprite.animation != anim:
		sprite.play(anim)

func apply_hit(damage: int, push: Vector2) -> void:
	if health <= 0:
		return
	health = max(health - damage, 0)
	knockback = push / body_mass
	if health <= 0:
		death_timer = 0.9
		collision_layer = 0
		collision_mask = 0
