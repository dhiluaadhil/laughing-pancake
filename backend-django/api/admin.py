from django.contrib import admin
from .models import User, Tag, Club, Post, Follow, Like, Comment, Notification

admin.site.register(User)
admin.site.register(Tag)
admin.site.register(Club)
admin.site.register(Post)
admin.site.register(Follow)
admin.site.register(Like)
admin.site.register(Comment)
admin.site.register(Notification)
