CREATE TABLE "todos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "todos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(200) NOT NULL,
	"tag" varchar(30),
	"is_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
