from backend.database import users


def test_users_table_includes_visible_model_ids_column():
    assert "visible_model_ids" in users.c

