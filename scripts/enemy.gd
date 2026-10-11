extends CharacterBody2D
## Generic enemy. Configure via setup(frames, hp, dmg, speed).

signal died(enemy: CharacterBody2D)

var max_health := 40
var health: int
var damage := 8
var walk_speed := 70.0
var target: Node2D
var state := "idle"
var attack_cooldown := 0.0
var hurt_timer := 0.0
var facing := -1

@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D

func setup(frames: SpriteFrames, p_health: int, p_damage: int, p_speed: float) -> void:
	sprite.sprite_frames = frames
	max_health = p_health
	health = p_health
	damage = p_damage
	walk_speed = p_speed

func _ready() -> void:
	health = max_health

func set_target(t: Node2D) -> void:
	target = t

func _physics_process(delta: float) -> void:
	attack_cooldown = maxf(attack_cooldown - delta, 0.0)
	hurt_timer = maxf(hurt_timer - delta, 0.0)

	if state == "dead":
		return
	if hurt_timer > 0.0:
		velocity = velocity.move_toward(Vector2.ZERO, 600.0 * delta)
		move_and_slide()
		_update_anim()
		return
	if target == null or not is_instance_valid(target):
		velocity = Vector2.ZERO
		move_and_slide()
		return

	var to_target := target.global_position - global_position
	var dist := to_target.length()

	if dist > 52.0:
		var dir := to_target.normalized()
		velocity = Vector2(dir.x * walk_speed, dir.y * walk_speed * 0.7)
		facing = 1 if dir.x > 0.0 else -1
		sprite.flip_h = facing < 0
		state = "walk"
	else:
		velocity = Vector2.ZERO
		facing = 1 if to_target.x > 0.0 else -1
		sprite.flip_h = facing < 0
		if attack_cooldown <= 0.0:
			state = "attack"
			attack_cooldown = 1.2
			if target.has_method("take_hit"):
				target.take_hit(damage, global_position.x)
		else:
			state = "idle"

	move_and_slide()
	_update_anim()

func take_hit(amount: int, from_x: float) -> void:
	if state == "dead":
		return
	health = maxi(health - amount, 0)
	hurt_timer = 0.35
	state = "hurt"
	var dir := 1.0 if global_position.x > from_x else -1.0
	velocity = Vector2(dir * 140.0, 0.0)
	if health <= 0:
		state = "dead"
		await get_tree().create_timer(0.9).timeout
		died.emit(self)
		queue_free()

func _update_anim() -> void:
	var anim := "idle"
	match state:
		"walk":
			anim = "walk"
		"attack":
			anim = "attack"
		"hurt":
			anim = "hurt"
		"dead":
			anim = "down"
	if sprite.animation != anim:
		sprite.play(anim)
