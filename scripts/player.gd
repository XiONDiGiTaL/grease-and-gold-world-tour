extends CharacterBody2D
## Playable fighter. SpriteFrames swap per character (Ricky/Johnny/V.V.).

signal health_changed(value: int, maximum: int)
signal hype_changed(value: float, maximum: float)

@export var walk_speed := 140.0
@export var depth_speed := 95.0
@export var max_health := 100
@export var max_hype := 100.0

var health: int
var hype := 0.0
var facing := 1
var state := "idle"
var attack_cooldown := 0.0
var hurt_timer := 0.0
var invuln_timer := 0.0

@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D

func _ready() -> void:
	health = max_health

func _physics_process(delta: float) -> void:
	attack_cooldown = maxf(attack_cooldown - delta, 0.0)
	hurt_timer = maxf(hurt_timer - delta, 0.0)
	invuln_timer = maxf(invuln_timer - delta, 0.0)

	if state == "dead":
		return
	if hurt_timer > 0.0:
		velocity = velocity.move_toward(Vector2.ZERO, 800.0 * delta)
		move_and_slide()
		_update_anim()
		return
	if attack_cooldown > 0.0:
		velocity = Vector2.ZERO
		move_and_slide()
		_update_anim()
		return

	var ix := Input.get_axis("move_left", "move_right")
	var iy := Input.get_axis("move_up", "move_down")
	velocity = Vector2(ix * walk_speed, iy * depth_speed)

	if ix != 0.0:
		facing = 1 if ix > 0.0 else -1
		sprite.flip_h = facing < 0

	if Input.is_action_just_pressed("attack"):
		_do_attack()
	elif Input.is_action_just_pressed("special") and hype >= max_hype:
		_do_special()
	elif Input.is_action_just_pressed("jump"):
		_do_jump()
	else:
		state = "walk" if (ix != 0.0 or iy != 0.0) else "idle"

	move_and_slide()
	_update_anim()

func _do_attack() -> void:
	state = "attack"
	attack_cooldown = 0.34
	add_hype(8.0)

func _do_special() -> void:
	state = "special"
	hype = 0.0
	hype_changed.emit(hype, max_hype)
	attack_cooldown = 0.7

func _do_jump() -> void:
	state = "jump"
	attack_cooldown = 0.45

func take_hit(damage: int, from_x: float) -> void:
	if invuln_timer > 0.0 or state == "dead":
		return
	health = maxi(health - damage, 0)
	health_changed.emit(health, max_health)
	hurt_timer = 0.4
	invuln_timer = 0.6
	state = "hurt"
	facing = -1 if from_x > global_position.x else 1
	sprite.flip_h = facing < 0
	velocity = Vector2(-facing * 170.0, 0.0)
	if health <= 0:
		state = "dead"

func add_hype(amount: float) -> void:
	hype = clampf(hype + amount, 0.0, max_hype)
	hype_changed.emit(hype, max_hype)

func _update_anim() -> void:
	var anim := "idle"
	match state:
		"walk":
			anim = "walk"
		"attack", "special":
			anim = "attack"
		"hurt":
			anim = "hurt"
		"dead":
			anim = "down"
		"jump":
			anim = "idle"
	if sprite.animation != anim:
		sprite.play(anim)
