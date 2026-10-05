import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { CommunityFeed } from './components/CommunityFeed';
import { QuickBookLookup } from './components/QuickBookLookup';
import { PwaBottomNav, PwaTab } from './components/PwaBottomNav';
import { PostBookSpotModal } from './components/PostBookSpotModal';
import { PhotoLightboxModal } from './components/PhotoLightboxModal';
import { SplashScreen } from './components/SplashScreen';
import { RegistrationWindow } from './components/RegistrationWindow';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AdminPanelModal } from './components/AdminPanelModal';
import { FeatureDemoTour } from './components/FeatureDemoTour';
import { PromotionsCarousel } from './components/PromotionsCarousel';
import { Stall, BookSpotting, UserProfile, Announcement, ModerationSettings, BookFairNoticeBanner as NoticeBannerType } from './types';
import { BMICH_STALLS } from './data/initialData';
import { apiFetch } from './utils/api';
import { useNotifications } from './hooks/useNotifications';
import { trackPageView, trackEvent } from './utils/analytics';
import { Search, MapPin, Building2, CreditCard, Check, Sparkles, Phone, ShieldCheck, Tag, Megaphone, Bell, X, Ban, AlertCircle } from 'lucide-react';

export default function App() {
  const [stalls, setStalls] = useState<Stall[]>(() => {
    try {
      const saved = localStorage.getItem('sampath_bmich_stalls');
      if (saved) {
        const parsed = JSON.parse(saved);
        const legacyDummyIds = new Set([
          'sarasavi-a', 'gunasena-b', 'vijitha-yapa-a', 'expographic-c',
          'grantha-s', 'lakehouse-b', 'godage-d', 'dayawansa-d',
          'sadeepa-b', 'makeen-a', 'jeya-a', 'samayawardhana-c',
          'buddhist-cultural-e', 'masterguide-e', 'jumpbooks-c'
        ]);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((s: Stall) => !legacyDummyIds.has(s.id));
          if (cleaned.length >= 100) {
            return cleaned;
          }
        }
      }
    } catch { }
    return BMICH_STALLS;
  });
  const [spots, setSpots] = useState<BookSpotting[]>(() => {
    try {
      const saved = localStorage.getItem('sampath_bmich_spots');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const realSpots = parsed.filter(
            (s: BookSpotting) =>
              !s.id.startsWith('dummy-spot-') &&
              !s.id.startsWith('spot-dummy-') &&
              !s.id.startsWith('req-dummy-')
          );
          return realSpots;
        }
      }
    } catch { }
    return [];
  });
  const spotsRef = useRef<BookSpotting[]>(spots);
  useEffect(() => {
    spotsRef.current = spots;
  }, [spots]);

  const [selectedHallFilter, setSelectedHallFilter] = useState('All Halls');
  const [activeTab, setActiveTab] = useState<PwaTab>('chat');
  const [showFeatureTour, setShowFeatureTour] = useState(false);
  // Key to force refresh CommunityFeed to latest 10 messages and point to last message
  const [chatRefreshKey, setChatRefreshKey] = useState<number>(0);

  // Track IDs of spots the user has already viewed in the chat feed
  const [viewedSpotIds, setViewedSpotIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('sampath_viewed_spot_ids');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch { }
    return new Set();
  });

  // Track the timestamp when the user last checked the chat feed
  const [lastViewedChatTime, setLastViewedChatTime] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sampath_last_viewed_chat_time');
      if (saved) return Number(saved);
    } catch { }
    return Date.now();
  });

  const checkIsAdminRoute = () => {
    return (
      window.location.pathname.toLowerCase().includes('admin') ||
      window.location.hash.toLowerCase().includes('admin') ||
      window.location.search.toLowerCase().includes('admin')
    );
  };

  // Admin Modal & Announcements State
  const [showAdminModal, setShowAdminModal] = useState(() => checkIsAdminRoute());
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // Book Fair Notice Banner State (Shown below header in chat page)
  const [noticeBanner, setNoticeBanner] = useState<NoticeBannerType>(() => {
    try {
      const saved = localStorage.getItem('sampath_book_fair_notice');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch { }
    return {
      enabled: true,
      message: 'BMICH Fair Notice: Special discount stalls now open in Hall E! Check them out for exclusive deals.',
      badgeText: 'FAIR NOTICE',
      theme: 'orange',
      isTicker: true,
      linkText: 'View Stalls',
      linkUrl: 'stalls',
      isClosable: true,
      updatedAt: new Date().toISOString()
    };
  });
  const [isNoticeDismissed, setIsNoticeDismissed] = useState<boolean>(false);

  // Registered spotters list (local storage)
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>(() => {
    try {
      const saved = localStorage.getItem('sampath_bookfair_user');
      return saved ? [JSON.parse(saved)] : [];
    } catch {
      return [];
    }
  });

  // Stalls Directory sub-tab search
  const [stallSearch, setStallSearch] = useState('');
  const [stallHallFilter, setStallHallFilter] = useState('All');

  // User Profile State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('sampath_bookfair_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.isDisabled) {
          localStorage.removeItem('sampath_bookfair_user');
          return null;
        }
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });

  // Flow State: Splash Screen only for unauthenticated first-time visitors
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    if (checkIsAdminRoute()) return false;
    try {
      const saved = localStorage.getItem('sampath_bookfair_user');
      // Already logged in - do not show splash screen on page refresh
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed?.isDisabled) return false;
      }
    } catch { }
    return true;
  });
  const [showRegistration, setShowRegistration] = useState(false);
  const [disabledAccountAlert, setDisabledAccountAlert] = useState<string | null>(null);


  // System Maintenance Mode State
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sampath_maintenance_mode');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Boolean(parsed.enabled);
      }
    } catch { }
    return false;
  });

  const [maintenanceMessage, setMaintenanceMessage] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('sampath_maintenance_mode');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.message) return parsed.message;
      }
    } catch { }
    return 'Sampath Book Finder is temporarily offline for scheduled system updates and stall inventory syncing. We will be back online shortly.';
  });

  const [isCheckingMaintenance, setIsCheckingMaintenance] = useState(false);

  const checkAllSettings = async () => {
    setIsCheckingMaintenance(true);
    try {
      // 1. Preferred: Single consolidated bootstrap call (66% fewer network requests)
      const bRes = await apiFetch('/api/settings/bootstrap').catch(() => null);
      if (bRes && bRes.ok) {
        const bData = await bRes.json();
        if (bData.maintenance) {
          const enabled = Boolean(bData.maintenance.enabled);
          setIsMaintenanceMode(enabled);
          if (bData.maintenance.message) {
            setMaintenanceMessage(bData.maintenance.message);
          }
          try {
            localStorage.setItem(
              'sampath_maintenance_mode',
              JSON.stringify({ enabled, message: bData.maintenance.message })
            );
          } catch { }
        }

        if (bData.moderation) {
          const settings: ModerationSettings = {
            profanityFilter: bData.moderation.profanityFilter !== false,
            aiSpotVerification: bData.moderation.aiSpotVerification !== false,
            imageGuardian: bData.moderation.imageGuardian !== false,
            updatedAt: bData.moderation.updatedAt
          };
          setModerationSettings(settings);
          try {
            localStorage.setItem('sampath_moderation_settings', JSON.stringify(settings));
          } catch { }
        }

        if (bData.notice?.notice) {
          const nData = bData.notice.notice;
          setNoticeBanner((prev) => {
            if (prev.message !== nData.message || prev.updatedAt !== nData.updatedAt) {
              setIsNoticeDismissed(false);
            }
            return nData;
          });
          try {
            localStorage.setItem('sampath_book_fair_notice', JSON.stringify(nData));
          } catch { }
        }
        return;
      }

      // Fallback for older server deployments
      const [mRes, modRes, nRes] = await Promise.all([
        apiFetch('/api/settings/maintenance'),
        apiFetch('/api/settings/moderation'),
        apiFetch('/api/settings/notice-banner')
      ]);

      if (mRes.ok) {
        const data = await mRes.json();
        const enabled = Boolean(data.enabled);
        setIsMaintenanceMode(enabled);
        if (data.message) {
          setMaintenanceMessage(data.message);
        }
        try {
          localStorage.setItem(
            'sampath_maintenance_mode',
            JSON.stringify({ enabled, message: data.message })
          );
        } catch { }
      }

      if (modRes.ok) {
        const data = await modRes.json();
        const settings: ModerationSettings = {
          profanityFilter: data.profanityFilter !== false,
          aiSpotVerification: data.aiSpotVerification !== false,
          imageGuardian: data.imageGuardian !== false,
          updatedAt: data.updatedAt
        };
        setModerationSettings(settings);
        try {
          localStorage.setItem('sampath_moderation_settings', JSON.stringify(settings));
        } catch { }
      }

      if (nRes.ok) {
        const data = await nRes.json();
        if (data.success && data.notice) {
          setNoticeBanner((prev) => {
            if (prev.message !== data.notice.message || prev.updatedAt !== data.notice.updatedAt) {
              setIsNoticeDismissed(false);
            }
            return data.notice;
          });
          try {
            localStorage.setItem('sampath_book_fair_notice', JSON.stringify(data.notice));
          } catch { }
        }
      }
    } catch {
      // Keep existing local state on network error
    } finally {
      setIsCheckingMaintenance(false);
    }
  };

  useEffect(() => {
    if (checkIsAdminRoute() && !sessionStorage.getItem('sampath_admin_token')) {
      return;
    }
    checkAllSettings();

    const handleSync = () => {
      if (document.hidden) return;
      if (checkIsAdminRoute() && !sessionStorage.getItem('sampath_admin_token')) return;
      checkAllSettings();
    };

    // Gentle sync every 3 minutes (180,000 ms) instead of 45 seconds
    const interval = setInterval(handleSync, 180000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleMaintenanceMode = async (enabled: boolean, message?: string) => {
    const finalMsg = message || maintenanceMessage;
    setIsMaintenanceMode(enabled);
    if (message) setMaintenanceMessage(message);

    localStorage.setItem(
      'sampath_maintenance_mode',
      JSON.stringify({ enabled, message: finalMsg })
    );

    try {
      const token = sessionStorage.getItem('sampath_admin_token') || '';
      await apiFetch('/api/settings/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': token
        },
        body: JSON.stringify({ enabled, message: finalMsg })
      });
    } catch (err) {
      console.error('Failed to sync maintenance status to server', err);
    }
  };

  // AI Moderation & Profanity Filter Settings
  const [moderationSettings, setModerationSettings] = useState<ModerationSettings>(() => {
    try {
      const saved = localStorage.getItem('sampath_moderation_settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch { }
    return {
      profanityFilter: true,
      aiSpotVerification: true,
      imageGuardian: true
    };
  });

  const handleUpdateModerationSettings = async (nextSettings: ModerationSettings) => {
    setModerationSettings(nextSettings);
    localStorage.setItem('sampath_moderation_settings', JSON.stringify(nextSettings));

    try {
      const token = sessionStorage.getItem('sampath_admin_token') || '';
      await apiFetch('/api/settings/moderation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': token
        },
        body: JSON.stringify(nextSettings)
      });
    } catch (err) {
      console.error('Failed to sync moderation settings to server', err);
    }
  };

  const handleUpdateNoticeBanner = async (nextNotice: NoticeBannerType) => {
    setNoticeBanner(nextNotice);
    setIsNoticeDismissed(false);
    localStorage.setItem('sampath_book_fair_notice', JSON.stringify(nextNotice));

    try {
      const token = sessionStorage.getItem('sampath_admin_token') || '';
      await apiFetch('/api/settings/notice-banner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': token
        },
        body: JSON.stringify(nextNotice)
      });
    } catch (err) {
      console.error('Failed to sync notice banner to server', err);
    }
  };

  useEffect(() => {
    if (checkIsAdminRoute()) {
      setShowSplash(false);
      setShowAdminModal(true);
    }

    const handleLocationChange = () => {
      if (checkIsAdminRoute()) {
        setShowSplash(false);
        setShowAdminModal(true);
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Track SPA tab and modal view transitions in Google Analytics 4
  useEffect(() => {
    const pagePath = showAdminModal ? '/admin' : `/${activeTab}`;
    const pageTitle = showAdminModal
      ? 'Sampath Book Finder - Admin Control Center'
      : `Sampath Book Finder - ${activeTab.toUpperCase()}`;
    trackPageView(pagePath, pageTitle);
  }, [activeTab, showAdminModal]);


  // Centralized forced logout for accounts suspended or disabled by an administrator
  const handleLogoutDueToDisabled = React.useCallback((message?: string) => {
    try {
      localStorage.removeItem('sampath_bookfair_user');
    } catch { }
    setUserProfile(null);
    setShowRegistration(true);
    setShowSplash(false);
    setDisabledAccountAlert(
      message ||
      'Your spotter account has been disabled by an administrator. You have been logged out automatically.'
    );
  }, []);

  // Listen to global account-disabled events emitted from any network calls (apiFetch)
  useEffect(() => {
    const handleAccountDisabledEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ message?: string }>;
      handleLogoutDueToDisabled(customEvent.detail?.message);
    };
    window.addEventListener('account-disabled', handleAccountDisabledEvent);
    return () => window.removeEventListener('account-disabled', handleAccountDisabledEvent);
  }, [handleLogoutDueToDisabled]);

  // Periodic heartbeat: Poll backend every 10 seconds to verify account active status
  useEffect(() => {
    if (!userProfile) return;

    let isMounted = true;

    const verifyAccountStatus = async () => {
      try {
        const query = new URLSearchParams();
        if (userProfile.id) query.set('id', String(userProfile.id));
        if (userProfile.handle) query.set('handle', userProfile.handle);
        if (userProfile.email) query.set('email', userProfile.email);

        const res = await apiFetch(`/api/auth/status?${query.toString()}`);
        if (!isMounted) return;

        if (res.status === 403) {
          const data = await res.json().catch(() => ({}));
          handleLogoutDueToDisabled(data.error || data.message);
          return;
        }

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.isDisabled) {
            handleLogoutDueToDisabled(data.error || data.message);
          }
        }
      } catch {
        // Keep resilient on temporary offline/network hiccup
      }
    };

    verifyAccountStatus();
    // Gentle background account status check every 3 minutes (180,000 ms)
    const interval = setInterval(() => {
      if (document.hidden) return;
      verifyAccountStatus();
    }, 180000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [userProfile?.id, userProfile?.handle, userProfile?.email, handleLogoutDueToDisabled]);

  // Post modal & Lightbox
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [initialBookForModal, setInitialBookForModal] = useState('');
  const [initialStallIdForModal, setInitialStallIdForModal] = useState('');
  const [replyingToSpot, setReplyingToSpot] = useState<BookSpotting | null>(null);
  const [highlightedSpotId, setHighlightedSpotId] = useState<string | null>(null);

  // User notifications for mentions and replies
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead
  } = useNotifications(spots, userProfile, announcements);

  // Mark all current spots as viewed whenever user is actively on the chat feed tab
  useEffect(() => {
    if (activeTab === 'chat' && spots.length > 0) {
      const now = Date.now();
      setLastViewedChatTime(now);
      try {
        localStorage.setItem('sampath_last_viewed_chat_time', String(now));
      } catch { }

      setViewedSpotIds((prev) => {
        let hasNew = false;
        const next = new Set(prev);
        spots.forEach((s) => {
          if (!next.has(s.id)) {
            next.add(s.id);
            hasNew = true;
          }
        });
        if (hasNew) {
          try {
            const arr = Array.from(next).slice(-500);
            localStorage.setItem('sampath_viewed_spot_ids', JSON.stringify(arr));
          } catch { }
          return next;
        }
        return prev;
      });
    }
  }, [activeTab, spots]);

  const handleSelectTab = (tab: PwaTab) => {
    if (tab === 'chat') {
      const now = Date.now();
      setLastViewedChatTime(now);
      try {
        localStorage.setItem('sampath_last_viewed_chat_time', String(now));
      } catch { }

      setViewedSpotIds((prev) => {
        let hasNew = false;
        const next = new Set(prev);
        spots.forEach((s) => {
          if (!next.has(s.id)) {
            next.add(s.id);
            hasNew = true;
          }
        });
        if (hasNew) {
          try {
            const arr = Array.from(next).slice(-500);
            localStorage.setItem('sampath_viewed_spot_ids', JSON.stringify(arr));
          } catch { }
          return next;
        }
        return prev;
      });
    }
    setActiveTab(tab);
  };

  // Set page title cleanly to Sampath Book Finder
  useEffect(() => {
    document.title = 'Sampath Book Finder';
  }, []);

  // Compute unread spots in chat feed (0 when viewing chat tab)
  const unreadChatCount = useMemo(() => {
    if (activeTab === 'chat') return 0;
    return spots.filter(
      (s) =>
        !s.isArchived &&
        !viewedSpotIds.has(s.id) &&
        (s.finderHandle ? s.finderHandle !== userProfile?.handle : true)
    ).length;
  }, [activeTab, spots, viewedSpotIds, userProfile?.handle]);

  const handleSelectNotification = (spotId?: string) => {
    handleSelectTab('chat');
    setSelectedHallFilter('all');
    if (spotId) {
      setHighlightedSpotId(spotId);
      setTimeout(() => {
        setHighlightedSpotId(null);
      }, 4500);
    }
  };

  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean;
    images: string[];
    bookTitle: string;
    stallName: string;
    initialIndex: number;
  }>({
    isOpen: false,
    images: [],
    bookTitle: '',
    stallName: '',
    initialIndex: 0
  });

  const handleSplashComplete = () => {
    if (isMaintenanceMode) return;
    setShowSplash(false);
    if (userProfile) {
      handleSelectTab('chat');
    } else {
      setShowRegistration(true);
    }
  };

  const loadData = React.useCallback(async () => {
    try {
      // Validate current user account status with backend
      if (userProfile) {
        try {
          const query = new URLSearchParams();
          if (userProfile.id) query.set('id', String(userProfile.id));
          if (userProfile.handle) query.set('handle', userProfile.handle);
          if (userProfile.email) query.set('email', userProfile.email);
          const statusRes = await apiFetch(`/api/auth/status?${query.toString()}`);
          if (statusRes.status === 403) {
            const sData = await statusRes.json().catch(() => ({}));
            handleLogoutDueToDisabled(sData.error || sData.message);
            return;
          }
        } catch { }
      }

      const isAdmin = Boolean(sessionStorage.getItem('sampath_admin_token'));
      const spotsEndpoint = isAdmin ? '/api/spots?include_archived=true' : '/api/spots';

      // Avoid refetching static stall records on every focus/load if already populated in state
      const needStalls = stalls.length === 0;

      const [stallsRes, spotsRes] = await Promise.all([
        needStalls ? apiFetch('/api/stalls') : Promise.resolve(null),
        apiFetch(spotsEndpoint)
      ]);

      if (stallsRes && stallsRes.ok) {
        const sData = await stallsRes.json();
        if (Array.isArray(sData.stalls)) {
          const legacyDummyIds = new Set([
            'sarasavi-a', 'gunasena-b', 'vijitha-yapa-a', 'expographic-c',
            'grantha-s', 'lakehouse-b', 'godage-d', 'dayawansa-d',
            'sadeepa-b', 'makeen-a', 'jeya-a', 'samayawardhana-c',
            'buddhist-cultural-e', 'masterguide-e', 'jumpbooks-c'
          ]);
          const cleanStalls = sData.stalls.filter((s: Stall) => !legacyDummyIds.has(s.id));
          if (cleanStalls.length > 0) {
            setStalls(cleanStalls);
            try {
              localStorage.setItem('sampath_bmich_stalls', JSON.stringify(cleanStalls));
            } catch { }
          }
        }
      }
      if (spotsRes.ok) {
        const pData = await spotsRes.json();
        if (Array.isArray(pData.spots)) {
          const legacyDummySpotIds = new Set([
            'spot-1', 'spot-2', 'spot-3', 'spot-4', 'spot-5', 'req-1', 'req-2', 'spot-hp-reply'
          ]);
          const cleanSpots = pData.spots.filter(
            (s: BookSpotting) =>
              !legacyDummySpotIds.has(s.id) &&
              !s.id.startsWith('dummy-spot-') &&
              !s.id.startsWith('spot-dummy-') &&
              !s.id.startsWith('req-dummy-')
          );
          setSpots(cleanSpots);
          try {
            localStorage.setItem('sampath_bmich_spots', JSON.stringify(cleanSpots));
          } catch { }
        }
      }
    } catch (err) {
      console.warn('Network sync notice:', err);
    }
  }, []);

  const pollLatestSpots = React.useCallback(async (forceFull = false) => {
    try {
      const currentSpots = spotsRef.current;
      const maxTs = forceFull ? 0 : currentSpots.reduce((max, s) => Math.max(max, s.timestamp || 0), 0);
      const url = maxTs > 0
        ? `/api/spots?since=${maxTs}`
        : '/api/spots?include_archived=true';

      const spotsRes = await apiFetch(url);
      if (spotsRes.ok) {
        const pData = await spotsRes.json();
        if (Array.isArray(pData.spots)) {
          if (pData.spots.length === 0) return;

          const legacyDummySpotIds = new Set([
            'spot-1', 'spot-2', 'spot-3', 'spot-4', 'spot-5', 'req-1', 'req-2', 'spot-hp-reply'
          ]);
          const incoming = pData.spots.filter(
            (s: BookSpotting) =>
              !legacyDummySpotIds.has(s.id) &&
              !s.id.startsWith('dummy-spot-') &&
              !s.id.startsWith('spot-dummy-') &&
              !s.id.startsWith('req-dummy-')
          );

          if (incoming.length === 0) return;

          setSpots((prev) => {
            const map = new Map<string, BookSpotting>();
            if (maxTs === 0) {
              incoming.forEach((s: BookSpotting) => map.set(s.id, s));
            } else {
              prev.forEach((s: BookSpotting) => map.set(s.id, s));
              incoming.forEach((s: BookSpotting) => map.set(s.id, s));
            }

            const merged = Array.from(map.values()).sort((a, b) => {
              if (a.isPinned && !b.isPinned) return -1;
              if (!a.isPinned && b.isPinned) return 1;
              return (b.timestamp || 0) - (a.timestamp || 0);
            });

            try {
              localStorage.setItem('sampath_bmich_spots', JSON.stringify(merged));
            } catch { }
            return merged;
          });
        }
      }
    } catch {
      // Ignore background network transient errors
    }
  }, []);

  useEffect(() => {
    // If on admin route and unauthenticated, defer loading data until logged in
    if (checkIsAdminRoute() && !sessionStorage.getItem('sampath_admin_token')) {
      return;
    }
    loadData();
    let lastFocus = Date.now();
    const handleFocus = () => {
      if (document.hidden) return;
      // 2 minutes cooldown (120,000 ms) on focus to prevent spamming server
      if (Date.now() - lastFocus < 120000) return;
      lastFocus = Date.now();
      loadData();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadData]);

  // Periodic background auto-fetch for chat spots feed (every 10 minutes, only active when chat tab is visible)
  useEffect(() => {
    if (activeTab !== 'chat') return;

    const pollInterval = setInterval(() => {
      if (document.hidden || isMaintenanceMode) return;
      pollLatestSpots();
    }, 10 * 60 * 1000); // 10 minutes (600,000 ms)

    return () => clearInterval(pollInterval);
  }, [pollLatestSpots, isMaintenanceMode, activeTab]);

  const handleSpotAdded = (newSpot: BookSpotting) => {
    setSpots((prev) => {
      const next = [newSpot, ...prev];
      try {
        localStorage.setItem('sampath_bmich_spots', JSON.stringify(next));
      } catch { }
      return next;
    });
    setChatRefreshKey((prev) => prev + 1);
    setViewedSpotIds((prev) => {
      const next = new Set(prev);
      next.add(newSpot.id);
      try {
        const arr = Array.from(next).slice(-500);
        localStorage.setItem('sampath_viewed_spot_ids', JSON.stringify(arr));
      } catch { }
      return next;
    });
    // Save to user's authored spots so replies trigger notifications
    try {
      const saved = localStorage.getItem('sampath_my_posted_spots');
      const arr = saved ? JSON.parse(saved) : [];
      if (!arr.includes(newSpot.id)) {
        arr.push(newSpot.id);
        localStorage.setItem('sampath_my_posted_spots', JSON.stringify(arr));
      }
    } catch { }

    trackEvent('spot_added', {
      book_name: newSpot.bookName,
      stall_name: newSpot.stallName,
      is_request: newSpot.postType === 'request',
    });
    handleSelectTab('chat');
  };

  const handleUpvoteSpot = async (spotId: string) => {
    setSpots((prev) =>
      prev.map((s) => {
        if (s.id === spotId) {
          const hasUpvoted = s.hasUserUpvoted;
          return {
            ...s,
            helpfulCount: hasUpvoted ? s.helpfulCount - 1 : s.helpfulCount + 1,
            hasUserUpvoted: !hasUpvoted
          };
        }
        return s;
      })
    );

    try {
      await apiFetch(`/api/spots/${spotId}/upvote`, { method: 'POST' });
    } catch (err) {
      console.error('Error upvoting spot:', err);
    }
  };

  const handleUpdateStatus = async (
    spotId: string,
    status: 'In Stock' | 'Few Copies Left' | 'Sold Out' | 'Looking for Book' | 'Found'
  ) => {
    setSpots((prev) =>
      prev.map((s) => (s.id === spotId ? { ...s, status } : s))
    );

    try {
      await apiFetch(`/api/spots/${spotId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleRateSpot = async (spotId: string, score: number) => {
    setSpots((prev) =>
      prev.map((s) => {
        if (s.id === spotId) {
          const currentCount = s.ratingCount || (s.helpfulCount > 0 ? 1 : 0);
          const currentAvg = s.ratingAverage || 5.0;
          const newCount = currentCount + 1;
          const newAvg = Number(((currentAvg * currentCount + score) / newCount).toFixed(1));
          return {
            ...s,
            ratingCount: newCount,
            ratingAverage: newAvg,
            helpfulCount: s.helpfulCount + 1,
            userRating: score
          };
        }
        return s;
      })
    );

    try {
      await apiFetch(`/api/spots/${spotId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score })
      });
    } catch (err) {
      console.error('Error rating spot:', err);
    }
  };

  const handleOpenNewSpotWithTitle = (title: string, stallId?: string) => {
    setInitialBookForModal(title);
    setInitialStallIdForModal(stallId || '');
    setIsPostModalOpen(true);
  };

  const openLightbox = (
    images: string[],
    bookTitle: string,
    stallName: string,
    initialIndex = 0
  ) => {
    setLightboxState({
      isOpen: true,
      images,
      bookTitle,
      stallName,
      initialIndex
    });
  };

  // Admin Moderation & CRUD Action Handlers
  const getAdminHeaders = () => {
    const token = sessionStorage.getItem('sampath_admin_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Admin-Token': token } : {})
    };
  };

  const handleDeleteSpot = async (spotId: string, userHandle?: string) => {
    const handle = userHandle || userProfile?.handle || '';
    setSpots((prev) => {
      const next = prev.filter((s) => s.id !== spotId);
      try {
        localStorage.setItem('sampath_bmich_spots', JSON.stringify(next));
      } catch { }
      return next;
    });
    setChatRefreshKey((prev) => prev + 1);
    try {
      await apiFetch(`/api/spots/${spotId}`, {
        method: 'DELETE',
        headers: {
          ...getAdminHeaders(),
          'X-User-Handle': handle
        },
        body: JSON.stringify({
          userHandle: handle
        })
      });
      pollLatestSpots(true);
    } catch (err) {
      console.error('Error deleting spot from database:', err);
    }
  };

  const handleArchiveSpot = async (spotId: string, userHandle?: string) => {
    const handle = userHandle || userProfile?.handle || 'user';
    setSpots((prev) => {
      const next = prev.map((s) =>
        s.id === spotId
          ? {
            ...s,
            isArchived: true,
            archivedAt: new Date().toISOString(),
            archivedBy: handle
          }
          : s
      );
      try {
        localStorage.setItem('sampath_bmich_spots', JSON.stringify(next));
      } catch { }
      return next;
    });
    setChatRefreshKey((prev) => prev + 1);
    try {
      await apiFetch(`/api/spots/${spotId}/archive`, {
        method: 'POST',
        headers: {
          ...getAdminHeaders(),
          'X-User-Handle': handle
        },
        body: JSON.stringify({ userHandle: handle })
      });
      pollLatestSpots(true);
    } catch (err) {
      console.error('Error archiving spot:', err);
    }
  };

  const handleUnarchiveSpot = async (spotId: string) => {
    setSpots((prev) =>
      prev.map((s) =>
        s.id === spotId
          ? {
            ...s,
            isArchived: false,
            archivedAt: undefined,
            archivedBy: undefined
          }
          : s
      )
    );
    try {
      await apiFetch(`/api/spots/${spotId}/unarchive`, {
        method: 'POST',
        headers: getAdminHeaders()
      });
      pollLatestSpots(true);
    } catch (err) {
      console.error('Error unarchiving spot:', err);
    }
  };

  const handleToggleArchiveSpot = async (spotId: string, userHandle?: string) => {
    const target = spots.find((s) => s.id === spotId);
    if (target?.isArchived) {
      await handleUnarchiveSpot(spotId);
    } else {
      await handleArchiveSpot(spotId, userHandle);
    }
  };

  const handleTogglePinSpot = async (spotId: string) => {
    setSpots((prev) =>
      prev.map((s) => (s.id === spotId ? { ...s, isPinned: !s.isPinned } : s))
    );
    try {
      await apiFetch(`/api/spots/${spotId}/pin`, {
        method: 'POST',
        headers: getAdminHeaders()
      });
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  };

  const handleToggleAiVerified = async (spotId: string) => {
    setSpots((prev) =>
      prev.map((s) => (s.id === spotId ? { ...s, aiVerified: !s.aiVerified } : s))
    );
    try {
      await apiFetch(`/api/spots/${spotId}/ai-verify`, {
        method: 'POST',
        headers: getAdminHeaders()
      });
    } catch (err) {
      console.error('Error toggling AI verified:', err);
    }
  };

  const handleUpdateSpot = async (spotId: string, updatedFields: Partial<BookSpotting>) => {
    setSpots((prev) =>
      prev.map((s) => (s.id === spotId ? { ...s, ...updatedFields } : s))
    );
    try {
      const res = await apiFetch(`/api/spots/${spotId}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify(updatedFields)
      });
      if (!res.ok) {
        console.error('Failed to update spot on server');
      }
    } catch (err) {
      console.error('Error updating spot in database:', err);
    }
  };

  const handleAddSpot = (newSpot: BookSpotting) => {
    setSpots((prev) => [newSpot, ...prev]);
    setChatRefreshKey((prev) => prev + 1);
  };

  const handleAddStall = async (newStall: Stall) => {
    setStalls((prev) => [newStall, ...prev]);
    try {
      await apiFetch('/api/stalls', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(newStall)
      });
    } catch (err) {
      console.error('Error creating stall in database:', err);
    }
  };

  const handleUpdateStall = async (stallId: string, updatedFields: Partial<Stall>) => {
    setStalls((prev) =>
      prev.map((s) => (s.id === stallId ? { ...s, ...updatedFields } : s))
    );
    try {
      await apiFetch(`/api/stalls/${stallId}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify(updatedFields)
      });
    } catch (err) {
      console.error('Error updating stall in database:', err);
    }
  };

  const handleDeleteStall = async (stallId: string) => {
    setStalls((prev) => {
      const updated = prev.filter((s) => s.id !== stallId);
      try {
        localStorage.setItem('sampath_bmich_stalls', JSON.stringify(updated));
      } catch { }
      return updated;
    });
    try {
      await apiFetch(`/api/stalls/${stallId}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      });
    } catch (err) {
      console.error('Error deleting stall from database:', err);
    }
  };

  const handleToggleHideStall = async (stallId: string) => {
    let nextHidden = false;
    setStalls((prev) => {
      const updated = prev.map((s) => {
        if (s.id === stallId) {
          nextHidden = !s.isHidden;
          return { ...s, isHidden: nextHidden };
        }
        return s;
      });
      try {
        localStorage.setItem('sampath_bmich_stalls', JSON.stringify(updated));
      } catch { }
      return updated;
    });

    try {
      await apiFetch(`/api/stalls/${stallId}/toggle-hide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        },
        body: JSON.stringify({ isHidden: nextHidden })
      });
    } catch (err) {
      console.error('Error toggling stall visibility:', err);
    }
  };

  const handleImportStalls = async (importedStalls: Stall[], mode: 'replace' | 'append') => {
    let updatedStalls: Stall[] = [];
    if (mode === 'replace') {
      updatedStalls = importedStalls;
    } else {
      const existingIds = new Set(stalls.map((s) => s.id));
      const toAdd = importedStalls.filter((s) => !existingIds.has(s.id));
      updatedStalls = [...stalls, ...toAdd];
    }

    setStalls(updatedStalls);
    try {
      localStorage.setItem('sampath_bmich_stalls', JSON.stringify(updatedStalls));
    } catch { }

    try {
      await apiFetch('/api/stalls/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        },
        body: JSON.stringify({ stalls: importedStalls, mode })
      });
    } catch (err) {
      console.error('Error importing stalls to backend:', err);
    }
  };

  const handlePublishAnnouncement = (announcement: Announcement) => {
    setAnnouncements((prev) => [announcement, ...prev]);
  };

  const handleDeleteAnnouncement = (id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  };

  const handleToggleUserCardholder = (handle: string) => {
    setRegisteredUsers((prev) =>
      prev.map((u) =>
        u.handle === handle
          ? { ...u, isSampathCardholder: !u.isSampathCardholder }
          : u
      )
    );
    if (userProfile && userProfile.handle === handle) {
      const updated = {
        ...userProfile,
        isSampathCardholder: !userProfile.isSampathCardholder
      };
      setUserProfile(updated);
      localStorage.setItem('sampath_bookfair_user', JSON.stringify(updated));
    }
  };

  const handleToggleDisableUser = (userIdOrHandle: string | number) => {
    const isCurrentUser =
      userProfile &&
      (String(userProfile.id) === String(userIdOrHandle) ||
        userProfile.handle === String(userIdOrHandle) ||
        userProfile.handle.replace(/^@/, '') === String(userIdOrHandle).replace(/^@/, ''));

    setRegisteredUsers((prev) =>
      prev.map((u) => {
        if (
          String(u.id) === String(userIdOrHandle) ||
          u.handle === String(userIdOrHandle) ||
          u.handle.replace(/^@/, '') === String(userIdOrHandle).replace(/^@/, '')
        ) {
          return { ...u, isDisabled: !u.isDisabled };
        }
        return u;
      })
    );

    if (isCurrentUser) {
      const willBeDisabled = !userProfile.isDisabled;
      if (willBeDisabled) {
        handleLogoutDueToDisabled(
          'Your spotter account was disabled by an administrator. You have been logged out automatically.'
        );
      } else {
        const updated = {
          ...userProfile,
          isDisabled: false
        };
        setUserProfile(updated);
        localStorage.setItem('sampath_bookfair_user', JSON.stringify(updated));
      }
    }
  };


  // Visible stalls for public visitors (hidden stalls excluded)
  const visibleStalls = stalls.filter((s) => !s.isHidden);

  // Available stall sections sorted by Stall Number letter (letters A, B, C, D, H, J, K, etc.)
  const availableHalls = useMemo(() => {
    const lettersSet = new Set<string>();

    visibleStalls.forEach((s) => {
      const letter = (s.stallNumber || '').trim().charAt(0).toUpperCase();
      if (letter && /^[A-Z]$/.test(letter)) {
        lettersSet.add(letter);
      }
    });

    // Ensure all standard CIBF 2026 fair letters are present (A, B, C, D, H, J, K, etc.)
    const standardLetters = ['A', 'B', 'C', 'D', 'H', 'J', 'K', 'L', 'M', 'P', 'Q', 'R', 'S', 'T'];
    standardLetters.forEach((l) => lettersSet.add(l));

    const sortedLetters = Array.from(lettersSet).sort((a, b) => a.localeCompare(b));
    return [
      { key: 'All', label: 'All' },
      ...sortedLetters.map((l) => ({ key: l, label: l }))
    ];
  }, [visibleStalls]);

  // Filtered stalls sorted naturally by Stall Number (letters A, K, etc.)
  const filteredStalls = useMemo(() => {
    return visibleStalls
      .filter((s) => {
        const letter = (s.stallNumber || '').trim().charAt(0).toUpperCase();
        const matchesLetter =
          stallHallFilter === 'All' ||
          letter === stallHallFilter ||
          (s.stallNumber && s.stallNumber.toUpperCase().startsWith(stallHallFilter));
        const matchesSearch =
          !stallSearch ||
          s.name.toLowerCase().includes(stallSearch.toLowerCase()) ||
          (s.category && s.category.toLowerCase().includes(stallSearch.toLowerCase())) ||
          (s.stallNumber && s.stallNumber.toLowerCase().includes(stallSearch.toLowerCase()));
        return matchesLetter && matchesSearch;
      })
      .sort((a, b) =>
        (a.stallNumber || '').localeCompare(b.stallNumber || '', undefined, {
          numeric: true,
          sensitivity: 'base'
        })
      );
  }, [visibleStalls, stallHallFilter, stallSearch]);

  const activeAnnouncement = announcements.find((a) => a.isActive);

  return (
    <div className="min-h-screen bg-[#18181B] flex justify-center selection:bg-[#F37021] selection:text-white">
      {/* Mobile PWA Shell container: Fits phones natively */}
      <div className="w-full max-w-md min-h-screen bg-white flex flex-col shadow-2xl relative">
        {/* 1. Splash Screen on Launch or Maintenance Mode */}
        {(showSplash || isMaintenanceMode) && (
          <SplashScreen
            onComplete={handleSplashComplete}
            isMaintenanceMode={isMaintenanceMode}
            maintenanceMessage={maintenanceMessage}
            onOpenAdmin={() => setShowAdminModal(true)}
            onRefreshStatus={checkAllSettings}
            isCheckingStatus={isCheckingMaintenance}
          />
        )}

        {/* Account Suspension Banner */}
        {disabledAccountAlert && (
          <div className="fixed top-4 left-4 right-4 max-w-md mx-auto z-[150] bg-rose-950/95 border-2 border-rose-500 text-white rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Ban className="w-5 h-5 text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-300">Account Access Suspended</h4>
                <p className="text-xs font-medium text-rose-100 mt-0.5 leading-relaxed">{disabledAccountAlert}</p>
              </div>
              <button
                type="button"
                onClick={() => setDisabledAccountAlert(null)}
                className="text-rose-400 hover:text-white p-1 rounded-lg hover:bg-rose-900/50 transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 2. Registration & Login Authentication Modal */}
        <RegistrationWindow
          isOpen={!isMaintenanceMode && (showRegistration || (!userProfile && !showSplash))}
          onClose={() => {
            const hasUser = !!userProfile || !!localStorage.getItem('sampath_bookfair_user');
            if (!hasUser) {
              // Unauthenticated users cannot bypass to chat; return to splash screen
              setShowRegistration(false);
              setShowSplash(true);
            } else {
              setShowRegistration(false);
            }
          }}
          onRegister={(profile) => {
            setUserProfile(profile);
            setShowRegistration(false);
            setShowSplash(false);
            setDisabledAccountAlert(null);
            handleSelectTab('chat');
            setRegisteredUsers((prev) => [...prev.filter(u => u.handle !== profile.handle), profile]);
            trackEvent('login', { method: 'profile', role: profile.role || 'user' });
          }}
          onProfileUpdate={(profile) => {
            setUserProfile(profile);
            setRegisteredUsers((prev) => [...prev.filter(u => u.handle !== profile.handle), profile]);
          }}
          onLogout={() => {
            setUserProfile(null);
            setShowRegistration(false);
            setShowSplash(true);
            setDisabledAccountAlert(null);
            trackEvent('logout');
          }}
          onStartTour={() => setShowFeatureTour(true)}
          currentProfile={userProfile}
          allowDismiss={!!userProfile}
          externalAlert={disabledAccountAlert}
          onClearExternalAlert={() => setDisabledAccountAlert(null)}
        />


        {/* 3. Admin Control Center Modal */}
        <AdminPanelModal
          isOpen={showAdminModal}
          onClose={() => {
            setShowAdminModal(false);
            if (checkIsAdminRoute()) {
              const basePath = window.location.pathname.startsWith('/cibf')
                ? '/cibf/'
                : window.location.pathname.startsWith('/booktrack')
                  ? '/booktrack/'
                  : '/';
              window.history.pushState({}, '', basePath);
            }
          }}
          spots={spots}
          stalls={stalls}
          announcements={announcements}
          registeredUsers={registeredUsers}
          onDeleteSpot={handleDeleteSpot}
          onUpdateSpot={handleUpdateSpot}
          onAddSpot={handleAddSpot}
          onTogglePinSpot={handleTogglePinSpot}
          onToggleAiVerified={handleToggleAiVerified}
          onToggleArchiveSpot={handleToggleArchiveSpot}
          onUpdateSpotStatus={handleUpdateStatus}
          onAddStall={handleAddStall}
          onUpdateStall={handleUpdateStall}
          onDeleteStall={handleDeleteStall}
          onPublishAnnouncement={handlePublishAnnouncement}
          onDeleteAnnouncement={handleDeleteAnnouncement}
          onToggleUserCardholder={handleToggleUserCardholder}
          onToggleDisableUser={handleToggleDisableUser}
          isMaintenanceMode={isMaintenanceMode}
          maintenanceMessage={maintenanceMessage}
          onToggleMaintenanceMode={handleToggleMaintenanceMode}
          onToggleHideStall={handleToggleHideStall}
          onImportStalls={handleImportStalls}
          onRefreshStalls={loadData}
          moderationSettings={moderationSettings}
          onUpdateModerationSettings={handleUpdateModerationSettings}
          noticeBanner={noticeBanner}
          onUpdateNoticeBanner={handleUpdateNoticeBanner}
        />

        {/* 4. Interactive Feature Demo Tour */}
        <FeatureDemoTour
          isOpen={showFeatureTour}
          onClose={() => setShowFeatureTour(false)}
          onNavigateTab={(tab) => handleSelectTab(tab)}
        />

        {/* ONLY AUTHENTICATED USERS CAN VIEW CHAT, HEADER, RADAR, STALLS, PERKS, AND NAVIGATION */}
        {userProfile ? (
          <>
            {/* Offline Status Bar */}
            <OfflineIndicator />

            {/* Streamlined Mobile PWA Top App Bar with Embedded Chat Header Notice Banner */}
            <Header
              activeTab={activeTab}
              spotsCount={spots.length}
              stallsCount={stalls.length}
              userProfile={userProfile}
              onOpenProfile={() => setShowRegistration(true)}
              onReplaySplash={() => setShowSplash(true)}
              notifications={notifications}
              unreadNotificationsCount={unreadCount}
              onMarkNotificationAsRead={markAsRead}
              onMarkAllNotificationsAsRead={markAllAsRead}
              onSelectNotification={handleSelectNotification}
              noticeBanner={noticeBanner}
              isNoticeDismissed={isNoticeDismissed}
              onDismissNotice={() => setIsNoticeDismissed(true)}
              onNavigateTab={(tab) => handleSelectTab(tab)}
            />

            {/* Main PWA View Switching */}
            <main className="flex-1 flex flex-col pb-16">
              {/* TAB 1: WhatsApp-Style Group Chat Feed */}
              {activeTab === 'chat' && (
                <CommunityFeed
                  spots={spots.filter((s) => !s.isArchived)}
                  selectedHallFilter={selectedHallFilter}
                  onSelectHallFilter={setSelectedHallFilter}
                  chatRefreshKey={chatRefreshKey}
                  onRefreshFeed={pollLatestSpots}
                  onOpenNewSpotModal={(title?: string, replySpot?: BookSpotting) => {
                    setInitialBookForModal(title || '');
                    setInitialStallIdForModal('');
                    setReplyingToSpot(replySpot || null);
                    setIsPostModalOpen(true);
                  }}
                  onUpvoteSpot={handleUpvoteSpot}
                  onRateSpot={handleRateSpot}
                  onUpdateStatus={handleUpdateStatus}
                  onViewPhotoLightbox={openLightbox}
                  userProfile={userProfile}
                  stalls={visibleStalls}
                  onQuickSpotSubmit={handleSpotAdded}
                  onArchiveSpot={handleArchiveSpot}
                  onDeleteSpot={handleDeleteSpot}
                  highlightedSpotId={highlightedSpotId}
                />
              )}

              {/* TAB 2: Dedicated Book Radar */}
              {activeTab === 'radar' && (
                <div className="p-3.5 sm:p-4 space-y-4 bg-zinc-50 flex-1">
                  <QuickBookLookup
                    spots={spots}
                    onSelectSpot={(spot) => {
                      if (spot.images.length > 0) {
                        openLightbox(spot.images, spot.bookName, spot.stallName, 0);
                      }
                    }}
                    onOpenNewSpotWithTitle={handleOpenNewSpotWithTitle}
                  />
                </div>
              )}

              {/* TAB 3: BMICH Stalls Guide */}
              {activeTab === 'stalls' && (
                <div className="p-3.5 sm:p-4 space-y-3 bg-zinc-50 flex-1">
                  <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#F37021]" />
                        <h2 className="text-sm font-black text-zinc-900">BMICH Stalls Directory</h2>
                      </div>
                      <span className="text-[11px] bg-orange-50 text-[#EA580C] font-bold px-2 py-0.5 rounded-full">
                        {filteredStalls.length} Stalls
                      </span>
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={stallSearch}
                        onChange={(e) => setStallSearch(e.target.value)}
                        placeholder="Search publisher or stall number..."
                        className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#F37021]"
                      />
                    </div>

                    {/* Hall Chips sorted using Stall number (letters A, K, etc.) */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                      {availableHalls.map((h) => (
                        <button
                          key={h.key}
                          onClick={() => setStallHallFilter(h.key)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap cursor-pointer transition-colors ${stallHallFilter === h.key
                              ? 'bg-zinc-900 text-white'
                              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                            }`}
                        >
                          {h.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stalls List */}
                  <div className="space-y-2">
                    {filteredStalls.map((stall) => (
                      <div
                        key={stall.id}
                        className="p-3 bg-white border border-zinc-200 rounded-xl shadow-xs flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-extrabold text-xs text-zinc-900 truncate">
                            {stall.name}
                          </div>
                          <div className="text-[11px] text-zinc-600 font-medium flex items-center gap-1.5 mt-0.5">
                            <MapPin className="w-3 h-3 text-[#F37021] flex-shrink-0" />
                            <span className="font-bold text-zinc-900 font-mono">Stall {stall.stallNumber}</span>
                          </div>
                          <span className="inline-block mt-1 text-[10px] text-zinc-600 bg-zinc-100 px-1.5 py-0.2 rounded font-medium">
                            {stall.category}
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            setInitialBookForModal('');
                            setInitialStallIdForModal(stall.id);
                            setIsPostModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-[#EA580C] text-[10px] font-black rounded-lg border border-orange-200 flex-shrink-0 cursor-pointer"
                        >
                          + Spot Book
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: Sampath Cardholder Privileges */}
              {activeTab === 'perks' && (
                <div className="p-3.5 sm:p-4 space-y-3.5 bg-zinc-50 flex-1">
                  <div className="bg-gradient-to-r from-[#F37021] via-[#EA580C] to-[#C2410C] text-white p-4 rounded-2xl shadow-sm space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-orange-200">
                      <CreditCard className="w-4 h-4" />
                      <span>Official Fair Sponsor</span>
                    </div>
                    <h3 className="text-base font-black text-white leading-tight">
                      Sampath Bank Cardholder Privileges
                    </h3>
                    <p className="text-xs text-orange-100 font-medium">
                      Enjoy instant discounts and on-site banking services at the Colombo International Book Fair 2026.
                    </p>
                  </div>

                  {/* Promotion Flyers Carousel & Instant Savings Notice */}
                  <PromotionsCarousel />

                  <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-xs space-y-2.5">
                    <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">
                      Fairground Services:
                    </h4>

                    <div className="flex items-start gap-2 text-xs text-zinc-700 p-2 bg-zinc-50 rounded-xl">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Mobile ATMs & Cash Booths:</strong> Located at Sirimavo Bandaranaike Hall & Main Entrance for fast cash withdrawals.
                      </span>
                    </div>

                    <div className="flex items-start gap-2 text-xs text-zinc-700 p-2 bg-zinc-50 rounded-xl">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Instant Card Activation:</strong> Visit the Sampath Pavilion at Hall A foyer for on-the-spot card assistance.
                      </span>
                    </div>

                    <div className="flex items-start gap-2 text-xs text-zinc-700 p-2 bg-zinc-50 rounded-xl">
                      <Phone className="w-4 h-4 text-[#F37021] flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>24/7 Fair Hotline:</strong> Call 011 2 300 604 for cardholder assistance.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </main>

            {/* 4. Native PWA Mobile Bottom Navigation Bar */}
            <PwaBottomNav
              activeTab={activeTab}
              onSelectTab={handleSelectTab}
              unreadChatCount={unreadChatCount}
              onOpenPostModal={() => {
                setInitialBookForModal('');
                setInitialStallIdForModal('');
                setIsPostModalOpen(true);
              }}
            />
          </>
        ) : (
          !showSplash && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-screen relative overflow-hidden select-none">
              <img
                src={`${import.meta.env.BASE_URL}splash/splash-bg.jpg`}
                alt="BMICH Atmosphere"
                className="absolute inset-0 w-full h-full object-cover object-center filter blur-xs brightness-75 scale-105"
              />
              <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" />
            </div>
          )
        )}

        {/* Modals */}
        <PostBookSpotModal
          isOpen={isPostModalOpen}
          onClose={() => {
            setIsPostModalOpen(false);
            setReplyingToSpot(null);
            setInitialBookForModal('');
            setInitialStallIdForModal('');
          }}
          stalls={visibleStalls}
          existingSpots={spots}
          initialBookTitle={initialBookForModal}
          initialStallId={initialStallIdForModal}
          replyToSpot={replyingToSpot}
          userProfile={userProfile}
          onSpotAdded={handleSpotAdded}
          isProfanityFilterEnabled={moderationSettings.profanityFilter}
          isImageGuardianEnabled={moderationSettings.imageGuardian}
        />

        <PhotoLightboxModal
          isOpen={lightboxState.isOpen}
          onClose={() => setLightboxState((prev) => ({ ...prev, isOpen: false }))}
          images={lightboxState.images}
          bookTitle={lightboxState.bookTitle}
          stallName={lightboxState.stallName}
          initialIndex={lightboxState.initialIndex}
        />
      </div>
    </div>
  );
}
