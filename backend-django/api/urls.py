from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, PostViewSet, ClubViewSet, CommentViewSet, 
    FollowViewSet, LikeViewSet, NotificationViewSet, FeedViewSet, SearchViewSet, TagViewSet
)
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'tags', TagViewSet, basename='tag')
router.register(r'posts', PostViewSet, basename='post')
router.register(r'clubs', ClubViewSet, basename='club')
router.register(r'comments', CommentViewSet, basename='comment')
router.register(r'follows', FollowViewSet, basename='follow')
router.register(r'likes', LikeViewSet, basename='like')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'feed', FeedViewSet, basename='feed')
router.register(r'search', SearchViewSet, basename='search')

urlpatterns = [
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('', include(router.urls)),
]
