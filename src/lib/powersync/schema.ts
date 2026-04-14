import { column, Schema, Table } from "@powersync/web";

const lists = new Table(
  {
    owner_id: column.text,
    name: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      owner: ["owner_id"],
    },
  },
);

const todos = new Table(
  {
    list_id: column.text,
    description: column.text,
    completed: column.integer,
    component: column.text,
    created_at: column.text,
    completed_at: column.text,
  },
  {
    indexes: {
      by_list: ["list_id"],
    },
  },
);

export const appSchema = new Schema({
  lists,
  todos,
});
