import {
  AppsIcon,
  DownloadIcon,
  GearIcon,
  BookIcon,
  HomeIcon,
  PeopleIcon,
} from "@primer/octicons-react";

export const routes = [
  {
    path: "/",
    nameKey: "home",
    render: () => <HomeIcon />,
  },
  {
    path: "/catalogue",
    nameKey: "catalogue",
    render: () => <AppsIcon />,
  },
  {
    path: "/library",
    nameKey: "library",
    render: () => <BookIcon />,
  },
  {
    path: "/downloads",
    nameKey: "downloads",
    render: () => <DownloadIcon />,
  },
  {
    path: "/friends",
    nameKey: "friends",
    render: () => <PeopleIcon />,
    requiresAuth: true,
  },
  {
    path: "/settings",
    nameKey: "settings",
    render: () => <GearIcon />,
    requiresAuth: false,
  },
];
