import {
  AppsIcon,
  DownloadIcon,
  GearIcon,
  BookIcon,
  PeopleIcon,
} from "@primer/octicons-react";

export const routes = [
  {
    path: "/catalogue",
    nameKey: "catalogue",
    render: () => <AppsIcon />,
  },
  {
    path: "/",
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
