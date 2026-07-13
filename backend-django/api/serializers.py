from rest_framework import serializers
from .models import User, Tag, Club, Post, Follow, Like, Comment, Notification

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    interests = serializers.PrimaryKeyRelatedField(many=True, queryset=Tag.objects.all(), required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'avatar_url', 'bio', 'college', 'role', 'email_verified', 'interests']

    def create(self, validated_data):
        interests = validated_data.pop('interests', [])
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        if interests:
            user.interests.set(interests)
        return user

class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name']

class PostSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)

    class Meta:
        model = Post
        fields = ['id', 'user', 'caption', 'image_url', 'club', 'created_at', 'tags']

class ClubSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)

    class Meta:
        model = Club
        fields = ['id', 'name', 'description', 'banner_url', 'created_by', 'created_at']

class CommentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'user', 'post', 'body', 'created_at']

class FollowSerializer(serializers.ModelSerializer):
    follower = UserSerializer(read_only=True)
    following = UserSerializer(read_only=True)

    class Meta:
        model = Follow
        fields = ['follower', 'following', 'created_at']

class LikeSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Like
        fields = ['user', 'post', 'created_at']

class NotificationSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = ['id', 'recipient', 'actor', 'type', 'post', 'read', 'created_at']
